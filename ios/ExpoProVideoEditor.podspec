Pod::Spec.new do |s|
  s.name           = 'ExpoProVideoEditor'
  s.version        = '1.0.0'
  s.summary        = 'Native video composition (trim, filters, overlays, audio mixing) for Expo'
  s.description    = 'Native video composition for Expo/React Native, adapted from pro_video_editor.'
  s.author         = 'manuel2u'
  s.homepage       = 'https://github.com/Manuel2u/expo-pro-video-editor'
  s.license        = { type: 'BSD-3-Clause', file: '../LICENSE' }
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
