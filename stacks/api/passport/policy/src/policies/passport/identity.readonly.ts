export default {
  _id: "IdentityReadOnlyAccess",
  name: "Identity Read Only Access",
  description: "Read only access to passport identity service.",
  statement: [
    {
      action: "passport:identity:index",
      resource: {
        include: "*"
      },
      module: "passport:identity"
    },
    {
      action: "passport:identity:show",
      resource: {
        include: "*"
      },
      module: "passport:identity"
    },
    {
      action: "preference:show",
      module: "preference",
      resource: ["passport"]
    }
  ]
};
