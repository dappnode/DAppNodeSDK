import { ListrTask } from "listr/index.js";
import { CliError } from "../../params.js";
import { ListrContextBuildAndPublish } from "../../types.js";
import {
    ReleaseUploaderConnectionError,
    IReleaseUploader
} from "../../releaseUploader/index.js";

export function getVerifyConnectionTask({ releaseUploader, skipUpload }: { releaseUploader: IReleaseUploader, skipUpload?: boolean }): ListrTask<ListrContextBuildAndPublish> {
    return {
        title: "Verify connection",
        skip: () => skipUpload,
        task: () => verifyConnection(releaseUploader)
    };
}

async function verifyConnection(releaseUploader: IReleaseUploader): Promise<void> {
    try {
        await releaseUploader.testConnection();
    } catch (e) {
        handleConnectionError(e);
    }
}

function handleConnectionError(e: Error): never {
    if (e instanceof ReleaseUploaderConnectionError) {
        throw new CliError(`Can't connect to ${e.ipfsProvider}: ${e.reason}. ${e.help || ""}`);
    } else {
        throw e;
    }
}