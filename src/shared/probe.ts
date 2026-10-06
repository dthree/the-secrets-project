export type ProbeSample = { id: number; target: string; distance: number };
export type ProbeReply = { id: number; level: 0 | 1 | 2 | 3; equipped: boolean };
export type ProbeRequest = { sample?: ProbeSample };
