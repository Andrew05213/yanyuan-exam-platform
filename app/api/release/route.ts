// Public, read-only build identity; no environment or account details.
export const dynamic="force-dynamic";
export function GET(){
 const value=(import.meta.env as Record<string,unknown>).VITE_YANYUAN_RELEASE;
 const revision=typeof value==="string"&&/^[a-f0-9]{40}$/.test(value)?value:"unknown";
 return Response.json({schema:1,revision},{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
