import { Manifest, Compose } from "@dappnode/types";
import { ManifestFormat } from "../../../files/manifest/types.js";
import { Github } from "../../../providers/github/Github.js";

export interface UpstreamSettings {
    repo: string;
    arg: string;
    manifestVersion: string;
    githubVersion: string;
}

export interface GitSettings {
    userName: string;
    userEmail: string;
}

export interface GithubSettings {
    repo: Github;
    repoData: Awaited<ReturnType<Github["getRepo"]>>;
    branchName: string;
    branchRef: string;
}

export interface GitBranch {
    branchName: string;
    branchRef: string;
}

export interface InitialSetupData {
    upstreamSettings: UpstreamSettings[] | null;
    manifestData: {
        manifest: Manifest;
        format: ManifestFormat;
    };
    compose: Compose;
    gitSettings: GitSettings;
    ethProvider: string;
}

export type UpstreamRepo = {
    repo: string;
    repoSlug: string;
    newVersion: string
};

export type ComposeVersionsToUpdate = {
    [repoSlug: string]: {
        newVersion: string;
        currentVersion: string;
    };
};