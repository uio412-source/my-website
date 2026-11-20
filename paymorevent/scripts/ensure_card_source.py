"""Restore locally editable JSON from the lossless tracked source snapshots."""
import gzip
from pathlib import Path

def ensure_card_data():
    for name in ['cards', 'document-research']:
        path=Path(__file__).resolve().parent.parent/'data'/(name+'.json')
        compressed=path.with_suffix('.json.gz')
        if not path.exists() and compressed.exists():
            path.write_bytes(gzip.decompress(compressed.read_bytes()))
