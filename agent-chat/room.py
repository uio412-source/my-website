"""Local GitHub issue chat and five-minute agent inbox."""
import argparse
import concurrent.futures
import functools
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OWNER = "uio412-source"
ENDPOINT = "repos/uio412-source/my-website/issues/391/comments"
AGENTS = ("Pickle", "ChatGPT", "Dot", "Claude", "Grok")
MESSAGE = re.compile(r"^<!-- room:(all|Pickle|ChatGPT|Dot|Claude|Grok) -->\n")
ANSWER = re.compile(r"^<!-- answer:(Pickle|ChatGPT|Dot|Claude|Grok):(\d+) -->\n")
HANDOFF = re.compile(r"^다음 담당: (Pickle|ChatGPT|Dot|Claude|Grok)$", re.M)
PORT = 8765


def github(*args, payload=None):
    cmd = ["gh", "api", *args]
    data = None
    if payload is not None:
        cmd.extend(["--input", "-"])
        data = json.dumps(payload)
    result = subprocess.run(cmd, input=data, text=True, capture_output=True, timeout=90)
    if result.returncode:
        raise RuntimeError("GitHub CLI 요청 실패. gh auth status 및 저장소 Issues 권한을 확인하세요.")
    return json.loads(result.stdout)


def comments():
    pages = github("--paginate", "--slurp", ENDPOINT + "?per_page=100")
    return [row for page in pages for row in page]


def post(body):
    return github(ENDPOINT, payload={"body": body})


class Handler(SimpleHTTPRequestHandler):
    def json_response(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed_host(self):
        return self.headers.get("Host") in {f"localhost:{PORT}", f"127.0.0.1:{PORT}"}

    def do_GET(self):
        if not self.allowed_host():
            return self.send_error(403)
        if self.path == "/room/mode":
            return self.json_response(200, {"local": True})
        if self.path == "/room/messages":
            try:
                return self.json_response(200, comments())
            except Exception:
                return self.send_error(502)
        if self.path.split("?")[0] not in {"/", "/index.html", "/chat.css", "/chat.js"}:
            return self.send_error(404)
        super().do_GET()

    def do_POST(self):
        if not self.allowed_host() or self.headers.get("Origin") != "http://" + self.headers["Host"]:
            return self.send_error(403)
        if self.path != "/room/messages":
            return self.send_error(404)
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if not 0 < n <= 150000:
                return self.send_error(413)
            body = json.loads(self.rfile.read(n))["body"]
            if not isinstance(body, str) or len(body) > 14500 or not MESSAGE.match(body):
                return self.send_error(400)
            result = post(body)
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        except (OSError, RuntimeError, subprocess.TimeoutExpired):
            return self.send_error(502)
        self.json_response(201, result)


def inbox(rows, agent):
    # Only owner-authored messages can initiate work. Resolve reply chains to their
    # owner-authored root; each agent may contribute at most once per root.
    roots, threads, pending, answered = {}, {}, {}, set()
    for row in rows:
        if row["user"]["login"].lower() != OWNER:
            continue
        key, body = row["id"], row["body"]
        msg, ans = MESSAGE.match(body), ANSWER.match(body)
        if msg:
            roots[key] = key
            threads[key] = [body[msg.end():]]
            if msg[1] in ("all", agent):
                pending[key] = key
        elif ans and int(ans[2]) in roots:
            root = roots[int(ans[2])]
            roots[key] = root
            reply = body[ans.end():]
            threads[root].append(ans[1] + ": " + reply)
            if ans[1] == agent:
                answered.add(root)
            if agent in HANDOFF.findall(reply):
                pending[root] = key
    return [(root, target, threads[root]) for root, target in pending.items() if root not in answered]


def run_agent(agent, command, rows, db_path):
    # Save generated replies before posting. Ambiguous POST outcomes are reconciled
    # against the issue on the next scan, without rerunning the agent.
    with sqlite3.connect(db_path, timeout=30) as db:
        for root, target, thread in inbox(rows, agent):
            cached = db.execute("SELECT body FROM replies WHERE agent=? AND root=?", (agent, root)).fetchone()
            if cached:
                body = cached[0]
            else:
                prompt = (f"당신은 {agent}입니다. 다음은 작업방에서 이 에이전트에 전달된 대화입니다. "
                          "자신이 실제로 수행한 작업과 근거만 한국어로 답하세요. 공유되는 답변에 비밀을 포함하지 마세요. "
                          "인계가 필요하면 마지막 줄에 '다음 담당: 이름'을 적으세요.\n" +
                          "\n\n".join(thread))
                result = subprocess.run(command, input=prompt, text=True, capture_output=True, timeout=600)
                if result.returncode or not result.stdout.strip():
                    raise RuntimeError(f"{agent} 실행 실패")
                body = f"<!-- answer:{agent}:{target} -->\n" + result.stdout.strip()[:50000]
                db.execute("INSERT INTO replies VALUES (?,?,?)", (agent, root, body))
                db.commit()
            post(body)
            # One request per agent per tick keeps bursts from monopolising the room.
            break


def worker(path):
    import fcntl
    path = Path(path).expanduser().resolve()
    cfg = json.loads(path.read_text())
    if not cfg or any(a not in AGENTS or not isinstance(c, list) or not c or
                      not all(isinstance(s, str) and s for s in c) for a, c in cfg.items()):
        raise SystemExit("설정 형식은 {에이전트 이름: [실행 파일, 인자, ...]}입니다.")
    state = Path(os.environ.get("XDG_STATE_HOME", Path.home()/".local/state"))/"mr-agent-chat"
    state.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock = (state/"worker.lock").open("a")
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    db_path = state/"outbox.sqlite"
    with sqlite3.connect(db_path) as db:
        db.execute("CREATE TABLE IF NOT EXISTS replies(agent TEXT, root INTEGER, body TEXT, PRIMARY KEY(agent, root))")
    if github("user")["login"].lower() != OWNER:
        raise SystemExit("작업방 소유자의 GitHub CLI 로그인이 필요합니다.")
    active = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(cfg)) as pool:
        while True:
            start = time.monotonic()
            try:
                rows = comments()
                for agent, command in cfg.items():
                    task = active.get(agent)
                    if task and not task.done():
                        continue
                    if task and task.exception():
                        print(agent, "직전 작업 실패, 다시 확인합니다.", file=sys.stderr, flush=True)
                    active[agent] = pool.submit(run_agent, agent, command, rows, db_path)
            except (OSError, ValueError, RuntimeError, subprocess.TimeoutExpired) as err:
                print(type(err).__name__, "작업방 조회 실패", file=sys.stderr, flush=True)
            time.sleep(max(0, 300 - (time.monotonic() - start)))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["serve", "work"])
    parser.add_argument("config", nargs="?")
    args = parser.parse_args()
    if args.mode == "work":
        if not args.config:
            parser.error("work에는 호스트의 실행 명령 설정 파일이 필요합니다.")
        worker(args.config)
    else:
        print(f"http://localhost:{PORT}", flush=True)
        ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler, directory=str(ROOT))).serve_forever()
