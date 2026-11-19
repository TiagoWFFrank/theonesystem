export const HORIZON_PLUGIN_SDK_VERSION = '0.5.0';

/** Define and type-check a declarative plugin manifest before publishing it. */
export function definePlugin(manifest) {
  if (manifest.format !== 'horizon-plugin' || manifest.manifestVersion !== 1) {
    throw new Error('Expected a The One System plugin manifest v1.');
  }
  return Object.freeze(manifest);
}

/** These Horizon components are used by the shared manifest renderer. */
export const HorizonComponents = Object.freeze([
  'PageHeader', 'Badge', 'Card', 'Field', 'Button', 'EmptyState',
  'DataList', 'DataTable', 'RecordDetail', 'LoadingState', 'ErrorState',
]);
