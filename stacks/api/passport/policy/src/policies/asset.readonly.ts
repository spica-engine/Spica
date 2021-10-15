export default {
  _id: "AssetReadOnlyAccess",
  name: "Asset Read Only Access",
  description: "Read only access to asset service.",
  statement: [
    {
      action: "apis:index",
      module: "apis"
    }
  ]
};
