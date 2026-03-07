export type AuthUser = {
    id: number;
    email: string;
    display_name: string;
    plan: string;
    user_type: "COMPANY" | "LOCAL";
};

export type LoginPayload = {
    email: string;
    password: string;
};

export type LoginResponse = {
    token: string;
    user: AuthUser;
};

export type SessionResponse = {
    authenticated: boolean;
    user: AuthUser;
};

export type ForgotPasswordPayload = {
    email: string;
};

export type VerifyCodePayload = {
    email: string;
    code: string;
};

export type VerifyCodeResponse = {
    valid: boolean;
    reset_token?: string;
};

export type ResetPasswordPayload = {
    reset_token: string;
    new_password: string;
};

export type BridgeAuthResponse = {
    authenticated: boolean;
    mode: string;
    user: {
        id: number;
        email: string;
        first_name: string;
        last_name: string;
        display_name: string;
        avatar_url: string | null;
    } | null;
    company: {
        id: number;
        name: string;
        slug: string;
        status: string;
    } | null;
    projects: Array<{
        id: number;
        name: string;
        description: string;
        status: string;
        role: string;
    }>;
};
