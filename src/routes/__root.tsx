import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { APP_NAME, BRAND_NAME, DEFAULT_DESCRIPTION, DEFAULT_TITLE, getSiteUrl } from "@/lib/seo";
import { initSupabaseAutoSync } from "@/lib/supabase-auto-sync";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const siteUrl = getSiteUrl();
    const ogImage = siteUrl ? `${siteUrl}/logo-app.png` : "/logo-app.png";
    const robots = import.meta.env.MODE === "production" ? "index,follow" : "noindex,nofollow";

    return {
      meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: DEFAULT_TITLE },
      { name: "description", content: DEFAULT_DESCRIPTION },
      { name: "application-name", content: APP_NAME },
      { name: "author", content: BRAND_NAME },
      { name: "robots", content: robots },
      { property: "og:site_name", content: BRAND_NAME },
      { property: "og:title", content: DEFAULT_TITLE },
      { property: "og:description", content: DEFAULT_DESCRIPTION },
      { property: "og:type", content: "website" },
      ...(siteUrl ? [{ property: "og:url", content: siteUrl }] : []),
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: DEFAULT_TITLE },
      { name: "twitter:description", content: DEFAULT_DESCRIPTION },
      { property: "og:image", content: ogImage },
      { name: "twitter:image", content: ogImage },
      ],
      links: [
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/logo.ico", type: "image/x-icon" },
      { rel: "shortcut icon", href: "/logo.ico", type: "image/x-icon" },
      ...(siteUrl ? [{ rel: "canonical", href: siteUrl }] : []),
      {
        rel: "stylesheet",
        href: appCss,
      },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  let jsonLdString: string | null = null;
  try {
    const siteUrl = getSiteUrl();
    const orgId = siteUrl ? `${siteUrl}#organization` : undefined;
    const appId = siteUrl ? `${siteUrl}#app` : undefined;
    const jsonLd = {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": orgId,
          name: BRAND_NAME,
          url: siteUrl ?? undefined,
          logo: siteUrl ? `${siteUrl}/logo-app.png` : undefined,
        },
        {
          "@type": "SoftwareApplication",
          "@id": appId,
          name: APP_NAME,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: DEFAULT_DESCRIPTION,
          offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
        },
      ],
    };
    jsonLdString = JSON.stringify(jsonLd);
  } catch {
    jsonLdString = null;
  }

  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        {jsonLdString ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString }} />
        ) : null}
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    initSupabaseAutoSync().catch((e) => console.error("initSupabaseAutoSync failed:", e));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
