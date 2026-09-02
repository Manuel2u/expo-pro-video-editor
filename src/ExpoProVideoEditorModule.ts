import { NativeModule, requireNativeModule } from 'expo';

declare class ExpoProVideoEditorModule extends NativeModule<{}> {}

export default requireNativeModule<ExpoProVideoEditorModule>('ExpoProVideoEditor');
