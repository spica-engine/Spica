export interface Storage{
  _id?: string;
  name: string;
  url?: string;
  content?: {
    type: string;
    size?: number;
  };
}

export type StorageNode = Storage & {
  index?:number;
  parent: StorageNode;
  children: StorageNode[];
  isDirectory: boolean;
  isHighlighted: boolean;
};
