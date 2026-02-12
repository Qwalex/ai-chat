export declare const ALLOWED_MODELS: {
    id: string;
    label: string;
}[];
export declare const DEFAULT_MODEL: string;
export declare const slugFromModelId: (id: string) => string;
export declare const MODEL_SHORT_DESCRIPTIONS: Record<string, string>;
export declare const SYSTEM_PROMPTS_BY_MODEL: Record<string, string>;
export declare const getSystemPromptForModel: (modelId: string) => string;
