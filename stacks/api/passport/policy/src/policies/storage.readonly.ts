export default {
  _id: "StorageReadOnlyAccess",
  name: "Storage Read Only Access",
  description: "Read only access to storage service.",
  statement: [
    {
      action: "storage:index",
      resource: {
        include: "*"
      },
      module: "storage"
    },
    {
      action: "storage:show",
      resource: {
        include: "*"
      },
      module: "storage"
    }
  ]
};
