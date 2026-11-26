import type { PrismaClient } from "@prisma/client";

const HRMS_PUBLIC_API_URL =
  process.env.HRMS_EMPLOYEES_API_URL ||
  "https://api.fishtailhrms.com/api/auth/employee/public";

export const REQUIRED_DEPARTMENTS = [
  {
    name: "Development",
    description:
      "Software engineering, full-stack, frontend, backend, WordPress, UI/UX, and DevOps.",
  },
  {
    name: "SEO",
    description:
      "Search engine optimization, organic growth, analytics, and digital visibility.",
  },
  {
    name: "QA & Testing",
    description:
      "Quality assurance, automated and manual software testing, and release sign-off.",
  },
  {
    name: "Content & Video",
    description:
      "Content creation, video generation, creative media, and copywriting.",
  },
  {
    name: "Human Resources",
    description:
      "People operations, talent acquisition, onboarding, and employee culture.",
  },
  {
    name: "Management",
    description:
      "Executive leadership, project management, and company operations.",
  },
] as const;

export function inferDepartmentFromProfession(
  profession?: string | null
): { name: string; description: string } | null {
  const p = (profession || "").trim();
  if (!p) return null;

  if (/\b(qa|q\.a\.|tester|testing|quality\s*assurance|quality)\b/i.test(p)) {
    return REQUIRED_DEPARTMENTS[2]; // QA & Testing
  }
  if (/\b(seo|search\s*engine|sem|ppc|digital\s*marketing)\b/i.test(p)) {
    return REQUIRED_DEPARTMENTS[1]; // SEO
  }
  if (
    /\b(dev|developer|engineer|programmer|software|frontend|front-end|backend|back-end|full\s*stack|wordpress|ui\/ux|ui|ux|devops|mobile|web|react|node|python|php|laravel)\b/i.test(
      p
    )
  ) {
    return REQUIRED_DEPARTMENTS[0]; // Development
  }
  if (
    /\b(content|video|editor|motion|graphic|creative|media|copywriter|writer|social\s*media)\b/i.test(
      p
    )
  ) {
    return REQUIRED_DEPARTMENTS[3]; // Content & Video
  }
  if (/\b(hr|human\s*resource|recruit|talent|people\s*ops)\b/i.test(p)) {
    return REQUIRED_DEPARTMENTS[4]; // Human Resources
  }
  if (
    /\b(ceo|cto|coo|cfo|md|managing\s*director|director|manager|founder|head|operations)\b/i.test(
      p
    )
  ) {
    return REQUIRED_DEPARTMENTS[5]; // Management
  }

  return null;
}

/**
 * Resolves the departmentId for a given HRMS profession by matching an existing
 * department (case-insensitive) or creating the mapped department automatically.
 */
export async function resolveOrCreateDepartmentId(
  prisma: PrismaClient,
  profession?: string | null
): Promise<string | null> {
  const mapped = inferDepartmentFromProfession(profession);
  if (!mapped) return null;

  const existing = await prisma.department.findFirst({
    where: {
      OR: [
        { name: mapped.name },
        // Gracefully match legacy typo if already present in DB
        ...(mapped.name === "Development" ? [{ name: "Developement" }] : []),
      ],
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.department.upsert({
    where: { name: mapped.name },
    update: {},
    create: {
      name: mapped.name,
      description: mapped.description,
    },
    select: { id: true },
  });

  return created.id;
}

const HRMS_ORIGIN = (() => {
  try {
    return new URL(HRMS_PUBLIC_API_URL).origin;
  } catch {
    return "https://api.fishtailhrms.com";
  }
})();

export interface HrmsEmployee {
  _id: string;
  name: string;
  email: string | null;
  picture: string | null;
  pictureUrl: string | null;
  profession: string | null;
  role: string | null;
  employmentType: string | null;
}

interface HrmsCache {
  fetchedAt: number;
  employees: HrmsEmployee[];
}

const CACHE_TTL_MS = 60_000; // 1 minute
let hrmsCache: HrmsCache | null = null;

function resolveHrmsPicture(picture: string | null | undefined): string | null {
  if (!picture) return null;
  const trimmed = picture.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return `${HRMS_ORIGIN}${trimmed}`;
  return `${HRMS_ORIGIN}/${trimmed}`;
}

export async function fetchHrmsEmployees(
  forceRefresh = false
): Promise<HrmsEmployee[]> {
  if (
    !forceRefresh &&
    hrmsCache &&
    Date.now() - hrmsCache.fetchedAt < CACHE_TTL_MS
  ) {
    return hrmsCache.employees;
  }

  try {
    const res = await fetch(HRMS_PUBLIC_API_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return hrmsCache?.employees ?? [];
    }

    const json = (await res.json()) as {
      employees?: Array<Record<string, unknown>>;
    };
    const rawList = Array.isArray(json)
      ? (json as Array<Record<string, unknown>>)
      : Array.isArray(json?.employees)
      ? json.employees
      : [];

    const employees: HrmsEmployee[] = rawList
      .filter((item) => item && typeof item === "object" && item.email)
      .map((item) => {
        const rawPic = typeof item.picture === "string" ? item.picture : null;
        return {
          _id: String(item._id ?? item.id ?? ""),
          name: typeof item.name === "string" ? item.name.trim() : "",
          email:
            typeof item.email === "string"
              ? item.email.trim().toLowerCase()
              : null,
          picture: rawPic,
          pictureUrl: resolveHrmsPicture(rawPic),
          profession:
            typeof item.profession === "string" ? item.profession.trim() : null,
          role: typeof item.role === "string" ? item.role.trim() : null,
          employmentType:
            typeof item.employmentType === "string"
              ? item.employmentType.trim()
              : null,
        };
      });

    hrmsCache = {
      fetchedAt: Date.now(),
      employees,
    };
    return employees;
  } catch {
    return hrmsCache?.employees ?? [];
  }
}

function matchByEmail(
  employees: HrmsEmployee[],
  email: string
): HrmsEmployee | null {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return null;
  return employees.find((emp) => emp.email === normalized) ?? null;
}

/**
 * Checks whether a signing-in Google user's email exists in Fishtail HRMS.
 * Strictly matches by exact lowercase email. If not found in the 60s cache,
 * automatically force-refreshes once so newly added HRMS employees can sign in
 * immediately without needing manual Admin approval.
 */
export async function findMatchingHrmsEmployee(input: {
  email: string;
  name?: string | null;
  googleAvatar?: string | null;
}): Promise<HrmsEmployee | null> {
  const cachedList = await fetchHrmsEmployees(false);
  const firstMatch = matchByEmail(cachedList, input.email);
  if (firstMatch) return firstMatch;

  // Force a live refresh in case the employee was just added to HRMS
  const freshList = await fetchHrmsEmployees(true);
  return matchByEmail(freshList, input.email);
}
