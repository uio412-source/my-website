export const COMMUNITY_TOPICS=['카드 추천','발급 캐시백','카드사 이벤트','호텔·여행','실적·혜택 질문','자유 이야기'] as const;
export type DiscussionComment={id:string;body:string;author:string;createdAt:string;canDelete:boolean};
export type CommunityPost={id:string;topic:string;title:string;body:string;author:string;createdAt:string;commentCount:number;canDelete:boolean};
