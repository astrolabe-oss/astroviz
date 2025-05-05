/**
 * Copyright 2025 Lightwire, LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @type {import('@vue/cli-service').ProjectOptions}
 */
module.exports = {
    // Prevent generation of source maps in production
    productionSourceMap: false,

    // Enable source maps for development
    chainWebpack: config => {
        config.devtool('source-map');
    },

    // CSS source maps for development
    css: {
        sourceMap: true
    },

    // Disable linting
    lintOnSave: false,

    // Configure webpack
    configureWebpack: {
        // Optimization settings
        optimization: {
            splitChunks: {
                // Split vendor chunks for better caching
                chunks: 'all',
                maxInitialRequests: Infinity,
                minSize: 0,
                cacheGroups: {
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name(module) {
                            // Extract vendor name for better debugging and caching
                            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
                            return `npm.${packageName.replace('@', '')}`;
                        }
                    }
                }
            }
        }
    },

    // Development server settings
    devServer: {
        port: 8080,
        open: true
    }
};