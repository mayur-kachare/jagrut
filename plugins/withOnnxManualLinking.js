const { withMainApplication } = require('@expo/config-plugins');

const withOnnxManualLinking = (config) => {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    // Add Import
    if (!contents.includes('import ai.onnxruntime.reactnative.OnnxruntimePackage')) {
      contents = contents.replace(
        'package com.jagrut.app',
        'package com.jagrut.app\n\nimport ai.onnxruntime.reactnative.OnnxruntimePackage'
      );
    }

    // Add Package to the list
    // We look for the PackageList block.
    // In Expo 52+ / React Native 0.76+ templates, it might look slightly different,
    // but the anchor `PackageList(this).packages.apply {` is standard for standard Expo templates.
    const anchor = 'PackageList(this).packages.apply {';
    if (contents.includes(anchor) && !contents.includes('add(OnnxruntimePackage())')) {
      contents = contents.replace(
        anchor,
        `${anchor}\n              add(OnnxruntimePackage())`
      );
    }

    config.modResults.contents = contents;
    return config;
  });
};

module.exports = withOnnxManualLinking;
