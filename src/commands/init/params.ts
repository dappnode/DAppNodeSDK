import defaultAvatar from "../../assets/defaultAvatar.js";
import { releasesRecordFileName } from "../../utils/releaseRecord.js";

export const stringsToRemoveFromName = [
    "DAppNode-package-",
    "DAppNodePackage-",
    "DAppNode-Package",
    "DAppNodePackage"
];

// Manifest
export const publicRepoDomain = ".public.dappnode.eth";
export const defaultVersion = "0.1.0";

// Avatar
export const avatarPath = "avatar-default.png";
export const avatarData = defaultAvatar;

// Dockerfile
export const dockerfilePath = "Dockerfile";
export const dockerfileData = `FROM busybox
  
  WORKDIR /usr/src/app
  
  ENTRYPOINT while true; do echo "happy build $USERNAME!"; sleep 1; done
  
  `;

// .gitignore
export const gitignorePath = ".gitignore";
export const gitignoreCheck = "build_*";
export const gitignoreData = `# DAppNodeSDK release directories
  build_*
  ${releasesRecordFileName}
  `;