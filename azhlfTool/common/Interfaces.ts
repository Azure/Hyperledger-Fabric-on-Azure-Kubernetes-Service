export interface MSP {
    msp_id: string;
    admincerts: string;
    cacerts: string;
    tlscacerts: string;
}

export interface AdminProfile {
    name: string;
    msp_id: string;
    cert: string;
    private_key: string;
    tls_cert: string;
    tls_private_key: string;
}

export interface ConnectionProfile {
    certificateAuthorities: Record<string, CertificateAuthority>;
    organizations: Record<string,Organization>;
    orderers?: Record<string,NodeEndpoint>;
    peers?: Record<string,NodeEndpoint>;
}

export interface NodeEndpoint{
    url: string;
}

export interface Organization{
    mspid: string;
    certificateAuthorities?: string[];
    orderers?: string[];
    peers?: string[];
}

export interface CertificateAuthority {
    caName: string;
    url: string;
    tlsCACerts: Certificate;
}

export interface Certificate {
    pem: string;
}
