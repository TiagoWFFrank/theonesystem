export type PluginAction = { id: string; label: string };
export type PluginOperationInput = {
  name: string;
  location: 'path' | 'query' | 'body';
  type: 'string' | 'integer';
  required?: boolean;
  default?: string | number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};
export type PluginOperation = {
  id: string;
  connection: string;
  method: 'GET' | 'POST';
  path: string;
  requires: string;
  inputs: PluginOperationInput[];
  response: { kind: 'collection' | 'record'; path: string };
};
export type PluginPageField = { label: string; field: string };
export type PluginRuntimeContext = {
  brandId: string;
  userId: string;
  params: Readonly<Record<string, string | undefined>>;
  navigate(path: string): void;
  operation(id: string, inputs?: Record<string, string | number>): Promise<unknown>;
};
export type PluginPage = {
  path: string;
  title: string;
  description?: string;
  requires?: string | string[];
  mode?: 'demo' | 'real';
  kind?: 'content' | 'list' | 'detail' | 'react';
  component?: string;
  operationId?: string;
  columns?: PluginPageField[];
  search?: { input: string; placeholder?: string };
  detailPath?: string;
  recordIdField?: string;
  recordIdParam?: string;
  fields?: PluginPageField[];
  configuration?: boolean;
  sections?: { title: string; body: string }[];
};
export type PluginManifest = {
  format: 'horizon-plugin';
  manifestVersion: 1;
  id: string;
  name: string;
  description: string;
  version: string;
  basePath: string;
  icon: 'Puzzle' | 'Package' | 'Boxes' | 'FileSearch';
  business?: boolean;
  compatibility?: { horizon: string; sdk: string };
  dependencies?: { id: string; range: string }[];
  actions: PluginAction[];
  operations?: PluginOperation[];
  menu: { label: string; path: string; requires?: string | string[] }[];
  requirements?: string[];
  pages: PluginPage[];
  configuration?: {
    title: string;
    description?: string;
    fields: { id: string; label: string; type: 'text' | 'url'; required?: boolean; placeholder?: string }[];
  };
  userConfiguration?: {
    title: string;
    description?: string;
    fields: { id: string; label: string; type: 'text' | 'url'; required?: boolean; placeholder?: string }[];
  };
  connections?: { id: string; label: string; settingKey: string; healthPath: string }[];
};
export declare const HORIZON_PLUGIN_SDK_VERSION: string;
export declare const HorizonComponents: readonly string[];
export declare function definePlugin<T extends PluginManifest>(manifest: T): Readonly<T>;
