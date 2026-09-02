import { registerWebModule, NativeModule } from 'expo';

// ExpoProVideoEditorModule is not available on the web platform.
class ExpoProVideoEditorModule extends NativeModule<{}> {}

export default registerWebModule(ExpoProVideoEditorModule, 'ExpoProVideoEditorModule');
