export interface SetupWizard {
  version: "2";
  fields: SetupWizardField[];
}

export interface SetupWizardField {
  id: string;
  target?: UserSettingTarget; // Allow form questions
  // UI
  title: string;
  description: string;
  secret?: boolean;
  // Validation options
  pattern?: string;
  patternErrorMessage?: string;
  enum?: string[];
  required?: boolean;
  if?: SetupSchema | { [id: string]: SetupSchema };
}

export type SetupSchema = {
  type?: string;
  title?: string;
  description?: string;
  default?: string;
  enum?: string[];
  pattern?: string;
  customErrors?: { pattern?: string };
  required?: string[];
  properties?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  dependencies?: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oneOf?: any[];
};

export type UserSettingTarget =
  | { type: "environment"; name: string; service?: string[] | string }
  | { type: "portMapping"; containerPort: string; service?: string }
  | { type: "namedVolumeMountpoint"; volumeName: string }
  | { type: "allNamedVolumesMountpoint" }
  | { type: "fileUpload"; path: string; service?: string };
