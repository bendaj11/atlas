declare function createReactWidgetEntries(options: any): any;
declare function createReactHostViteConfig(options: any): {
    plugins: ({
        name: any;
        configureServer(server: any): void;
        writeBundle(): void;
    } | {
        name: string;
        resolveId(source: any): string;
        load(id: any): string;
    } | {
        name: string;
        apply: "serve";
        enforce: "pre";
        transform(code: any, id: any): string;
    } | {
        name: string;
        apply: "serve";
        handleHotUpdate({ file, server }: {
            file: any;
            server: any;
        }): any[];
    })[];
    build: {
        target: string;
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
    plugins: ({
        name: any;
        configureServer(server: any): void;
        writeBundle(): void;
    } | {
        name: string;
        resolveId(source: any): string;
        load(id: any): string;
    } | {
        name: string;
        apply: "serve";
        enforce: "pre";
        transform(code: any, id: any): string;
    } | {
        name: string;
        apply: "serve";
        handleHotUpdate({ file, server }: {
            file: any;
            server: any;
        }): any[];
    })[];
    build: {
        target: string;
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
declare function createAngularFederationOptions(options: any, shareAll: any): {
    name: any;
    exposes: {
        './host': any;
    } | {
        './entry': any;
        './host'?: undefined;
    } | {
        './host'?: undefined;
    };
    shared: any;
    skip: string[];
};
export { createAngularFederationConfig, createAngularFederationOptions, createReactAppViteConfig, createReactHostViteConfig, createReactWidgetEntries, };
