# npm Proxy/403 Fix Guide

If you see errors like:

- `npm warn Unknown env config "http-proxy"`
- `npm error code E403`
- `npm error 403 Forbidden - GET https://registry.npmjs.org/lighthouse`

Use the steps below.

## 1) Remove invalid npm proxy key

`http-proxy` is not a supported npm config key. Use `proxy` and `https-proxy`.

```bash
npm config delete http-proxy
unset npm_config_http_proxy
```

## 2) Verify active proxy env vars

```bash
env | grep -i proxy
```

If you are **not** supposed to use a proxy, unset these:

```bash
unset http_proxy
unset https_proxy
unset HTTP_PROXY
unset HTTPS_PROXY
```

If your network **does** require a proxy, set valid keys:

```bash
npm config set proxy http://<proxy-host>:<port>
npm config set https-proxy http://<proxy-host>:<port>
```

## 3) Validate registry and auth

```bash
npm config get registry
npm whoami || npm login
```

Expected registry for public npm packages:

- `https://registry.npmjs.org/`

If needed:

```bash
npm config set registry https://registry.npmjs.org/
```

## 4) Test direct package metadata access

```bash
npm view lighthouse version --registry=https://registry.npmjs.org/
```

- If this still returns `403`, your company proxy/security policy is likely blocking access.
- If it succeeds, your local/project npm config is likely the issue.

## 5) Retry install

```bash
npm cache clean --force
npm install
```
