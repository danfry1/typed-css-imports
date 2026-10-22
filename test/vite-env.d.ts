// Same shape as vite/client's and next's CSS module declarations.
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
