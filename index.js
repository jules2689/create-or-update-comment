const { inspect } = require("util");
const core = require("@actions/core");
const github = require("@actions/github");

const REACTION_TYPES = [
  "+1",
  "-1",
  "laugh",
  "confused",
  "heart",
  "hooray",
  "rocket",
  "eyes"
];

async function addReaction(octokit, repo, comment_id, reactionType) {
  if (REACTION_TYPES.includes(reactionType)) {
    await octokit.reactions.createForIssueComment({
      owner: repo[0],
      repo: repo[1],
      comment_id: comment_id,
      content: reactionType
    });
    core.info(`Set '${reactionType}' reaction on comment.`);
  } else {
    core.setFailed("Invalid 'reaction-type'.");
    return;
  }
}

async function run() {
  try {
    const inputs = {
      token: core.getInput("token"),
      repository: core.getInput("repository"),
      issueNumber: core.getInput("issue-number"),
      commentId: core.getInput("comment-id"),
      body: core.getInput("body"),
      editMode: core.getInput("edit-mode"),
      replaceNewLine: core.getInput("replace-new-line"),
      commentHash: core.getInput("comment-hash"),
      reactionType: core.getInput("reaction-type")
    };
    core.debug(`Inputs: ${inspect(inputs)}`);

    const repository = inputs.repository
      ? inputs.repository
      : process.env.GITHUB_REPOSITORY;
    const repo = repository.split("/");
    core.debug(`repository: ${repository}`);

    const editMode = inputs.editMode ? inputs.editMode : "append";
    core.debug(`editMode: ${editMode}`);
    if (!["append", "replace"].includes(editMode)) {
      core.setFailed(`Invalid edit-mode '${editMode}'.`);
      return;
    }

    const octokit = new github.GitHub(inputs.token);

    let commentId = inputs.commentId;
    core.debug(`Comment ID: '${commentId}'`)
    if ((commentId == null || commentId === '') && inputs.commentHash) {
      const { data: issues } = await octokit.issues.listComments({
        owner: repo[0],
        repo: repo[1],
        issue_number: inputs.issueNumber
      });

      for (const issue of issues) {
        core.debug(`issue: ${issue.id} // ${issue.body}`)
        if (issue.body.startsWith(`<!-- ${inputs.commentHash} -->`)) {
          commentId = issue.id;
          break;
        }
      }
    }
    
    if (commentId) {
      // Edit a comment
      if (!inputs.body && !inputs.reactionType) {
        core.setFailed("Missing either comment 'body' or 'reaction-type'.");
        return;
      }

      if (inputs.body) {
        var commentBody = "";
        if (editMode == "append") {
          // Get the comment body
          const { data: comment } = await octokit.issues.getComment({
            owner: repo[0],
            repo: repo[1],
            comment_id: commentId
          });
          commentBody = comment.body + "\n";
        }

        commentBody = commentBody + inputs.body;
        core.debug(`Comment body: ${commentBody}`);

        if (inputs.replaceNewLine) {
          commentBody = commentBody.replace(/\\n/g,'\n')
          core.debug(`Replaced new line... Comment body: ${commentBody}`);
        }

        if (inputs.commentHash) {
          commentBody = `<!-- ${inputs.commentHash} -->` + commentBody;
        }

        await octokit.issues.updateComment({
          owner: repo[0],
          repo: repo[1],
          comment_id: commentId,
          body: commentBody
        });
        core.info(`Updated comment id '${commentId}'.`);
      }

      // Set a comment reaction
      if (inputs.reactionType) {
        await addReaction(octokit, repo, commentId, inputs.reactionType);
      }
    } else if (inputs.issueNumber) {
      // Create a comment
      if (!inputs.body) {
        core.setFailed("Missing comment 'body'.");
        return;
      }

      let commentBody = inputs.body;
      core.debug(`Comment body: ${commentBody}`);

      if (inputs.replaceNewLine) {
        commentBody = commentBody.replace(/\\n/g,'\n')
        core.debug(`Replaced new line... Comment body: ${commentBody}`);
      }

      if (inputs.commentHash) {
        commentBody = `<!-- ${inputs.commentHash} -->` + commentBody;
      }

      const { data: comment } = await octokit.issues.createComment({
        owner: repo[0],
        repo: repo[1],
        issue_number: inputs.issueNumber,
        body: commentBody
      });
      core.info(`Created comment on issue '${inputs.issueNumber}'.`);

      // Set a comment reaction
      if (inputs.reactionType) {
        await addReaction(octokit, repo, comment.id, inputs.reactionType);
      }
    } else {
      core.setFailed("Missing either 'issue-number' or 'comment-id'.");
      return;
    }
  } catch (error) {
    core.debug(inspect(error));
    core.setFailed(error.message);
  }
}

run();
