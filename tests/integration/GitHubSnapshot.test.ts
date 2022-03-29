import { context, getMocks } from "../mocks";
const { setData, restoreInitialData, mocks } = getMocks();

// actually run syft so we know if this output format is properly working
delete mocks["@actions/tool-cache"];
delete mocks["@actions/exec"];

// set up a mock for octokit.request
let requestArgs: any;
const mockCreator = mocks["@actions/github"];
mocks["@actions/github"] = () => {
  const actionsBase = mockCreator() as any;
  return {
    ...actionsBase,
    getOctokit() {
      const kit = actionsBase.getOctokit();
      kit.request = (...args: any[]) => {
        requestArgs = args;
        return args;
      }
      return kit;
    }
  }
}
for (const mock of Object.keys(mocks)) {
  jest.mock(mock, mocks[mock]);
}

// setting up mocks must happen before this import
import * as action from "../../src/github/SyftGithubAction";

jest.setTimeout(30000);
Date.now = jest.fn(() => 1482363367071);

describe("GitHub Snapshot", () => {
  beforeEach(() => {
    restoreInitialData();
  });

  it("runs with default inputs", async () => {
    setData({
      inputs: {
        path: ".",
        "dependency-snapshot": "true",
        "upload-artifact": "false",
      },
      context: {
        ...context.push({
          ref: "main",
        }),
        sha: "f293f09uaw90gwa09f9wea",
        job: "default-import-job",
        action: "__anchore_sbom-action",
      },
    });

    await action.runSyftAction();
    await action.uploadDependencySnapshot();

    // validate the request was made
    expect(requestArgs).toBeDefined();
    expect(requestArgs).toHaveLength(2);
    expect(requestArgs[0]).toBe("POST /repos/test-org/test-repo/dependency-graph/snapshots");

    // check the resulting snapshot file
    const data = requestArgs[1].data;
    const submission = JSON.parse(data);

    expect(submission.scanned).toBeDefined();

    // redact changing data
    submission.scanned = "";
    submission.detector.version = "";

    expect(submission).toMatchSnapshot();
  });
});
