declare function createReactWidgetEntries(options: any): any;
declare function createReactHostViteConfig(options: any): {
    plugins: any[];
    build: {
        target: string;
        commonjsOptions: {
            include: (string | RegExp)[];
        };
        rollupOptions: {
            input: any;
            external: (source: any) => boolean;
            output: {
                entryFileNames: ({ name }: {
                    name: any;
                }) => "host.js" | "[name].js";
                chunkFileNames: string;
                assetFileNames: string;
            };
            preserveEntrySignatures: "exports-only";
        };
    };
};
declare function createReactAppViteConfig(options: any): {
    plugins: any[];
    build: {
        target: string;
        commonjsOptions: {
            include: (string | RegExp)[];
        };
        rollupOptions: {
            input: any;
            external: (source: any) => boolean;
            output: {
                entryFileNames: string;
                chunkFileNames: string;
                assetFileNames: string;
            };
            preserveEntrySignatures: "exports-only";
        };
    };
};
declare function createAngularFederationConfig(options: any): any;
declare function createAngularFederationOptions(options: any, shareAll: any): any;
export { createAngularFederationConfig, createAngularFederationOptions, createReactAppViteConfig, createReactHostViteConfig, createReactWidgetEntries, };
