export default {
  _id: "EnvVarsReadOnlyAccess",
  name: "Environment Variables Read Only Access",
  description: "Read only access to function environment variables service.",
  statement: [
    {
      action: "env-vars:index",
      resource: {include: ["*"], exclude: []},
      module: "env-vars"
    },
    {
      action: "env-vars:show",
      resource: {include: ["*"], exclude: []},
      module: "env-vars"
    }
  ]
};
