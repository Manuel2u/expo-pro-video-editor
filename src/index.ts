// Reexport the native module. On web, it will be resolved to ExpoProVideoEditorModule.web.ts
// and on native platforms to ExpoProVideoEditorModule.ts
export { default } from './ExpoProVideoEditorModule';
export * from './ExpoProVideoEditor.types';
