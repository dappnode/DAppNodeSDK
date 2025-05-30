export enum SetupWizardFormat {
  json = "json",
  yml = "yml",
  yaml = "yaml"
}

export interface SetupWizardPaths {
  /** './folder', [optional] directory to load the setup-wizard from */
  dir?: string;
  /** 'setup-wizard-admin.json', [optional] name of the setup-wizard file */
  setupWizardFileName?: string;
}
