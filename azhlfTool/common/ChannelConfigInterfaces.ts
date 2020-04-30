export interface AnchorPeer {
    host: string;
    port: number;
}

export interface AnchorPeersValue{
    anchor_peers: AnchorPeer[]
}

export interface AnchorPeersSection{
    mod_policy: string;
    value: AnchorPeersValue;
    version: number;
}
