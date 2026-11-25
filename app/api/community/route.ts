import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";
import { AREAS, DAYS, MAX_ACTIVE_POSTS, MAX_POSTS_PER_24_HOURS, POSTING_LIMITS, TERMS_VERSION, type Community, type Intro, type Listing } from "../../../lib/community";

export const dynamic = "force-dynamic";

const day = 24 * 60 * 60 * 1_000;
const postLifetime = 60 * day;
const activityWindow = 180 * day;
const activeListing = "removed_at IS NULL AND hidden_at IS NULL AND expires > ?";
const listingFields = 'id, kind, role, title, area, destination, days, date, "start", "end", note, name, purdue, near_citybus AS nearCityBus, expires';
const areaNames = new Set<string>(AREAS);
const dayNames = new Set<string>(DAYS);
const timeZone = "America/Indiana/Indianapolis";
const localDate = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
const localHour = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" });

type ListingRow = Omit<Listing, "days" | "purdue" | "nearCityBus"> & { days: string; purdue: number; nearCityBus: number };
type ListingInput = Omit<Listing, "id" | "name" | "expires">;
type Input = Record<string, unknown>;

function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

class RequestError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}

function failure(cause: unknown) {
  if (cause instanceof RequestError) return json({ error: cause.message }, cause.status);
  console.error("Community API request failed", cause instanceof Error ? cause.name : "UnknownError");
  return json({ error: "The board is temporarily unavailable. Please try again shortly." }, 503);
}

function database() {
  if (!env.DB) throw new Error("Missing database binding");
  return env.DB;
}

function displayName(user: ChatGPTUser) {
  const first = user.fullName?.trim().split(/\s+/, 1)[0];
  return first && /^[\p{L}\p{M}'’.-]{1,35}$/u.test(first) ? first : "Neighbor";
}

function purdueEmail(user: ChatGPTUser) {
  return /^[^@\s]+@purdue\.edu$/i.test(user.email);
}

function decodeListing(row: ListingRow): Listing {
  return { ...row, days: JSON.parse(row.days), purdue: row.purdue === 1, nearCityBus: row.nearCityBus === 1 };
}

export async function GET() {
  try {
    const user = await getChatGPTUser();
    const db = database();
    const now = Date.now();
    const publicQuery = db.prepare(
      `SELECT ${listingFields} FROM listings WHERE ${activeListing} ORDER BY updated_at DESC, id LIMIT 250`,
    ).bind(now).all<ListingRow>();
    const data: Community = { user: user ? { name: displayName(user), purdueEmail: purdueEmail(user) } : null, listings: [], own: [], intros: [] };

    if (user) {
      const [publicRows, ownRows, intros] = await Promise.all([
        publicQuery,
        db.prepare(`
          SELECT ${listingFields} FROM listings
          WHERE owner_id = ? AND removed_at IS NULL
          ORDER BY updated_at DESC, id LIMIT 100
        `).bind(user.userId).all<ListingRow>(),
        db.prepare(`
          SELECT i.id, i.listing_id AS listingId, i.title, i.note, i.status,
            CASE WHEN i.sender_id = ?1 THEN 'sent' ELSE 'received' END AS direction,
            CASE WHEN i.sender_id = ?1 THEN i.recipient_name ELSE i.sender_name END AS name,
            CASE WHEN i.status = 'accepted'
              THEN CASE WHEN i.sender_id = ?1 THEN i.recipient_email ELSE i.sender_email END
              ELSE NULL END AS contact
          FROM intros i
          JOIN listings l ON l.id = i.listing_id
          WHERE (i.sender_id = ?1 OR i.recipient_id = ?1)
            AND i.updated_at >= ?2
            AND (i.status != 'pending' OR (l.removed_at IS NULL AND l.hidden_at IS NULL AND l.expires > ?3))
          ORDER BY i.updated_at DESC, i.id LIMIT 200
        `).bind(user.userId, now - activityWindow, now).all<Intro>(),
      ]);
      data.listings = publicRows.results.map(decodeListing);
      data.own = ownRows.results.map(decodeListing);
      data.intros = intros.results;
    } else {
      data.listings = (await publicQuery).results.map(decodeListing);
    }
    return json(data);
  } catch (cause) {
    return failure(cause);
  }
}

async function readInput(request: Request): Promise<Input> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim() !== "application/json") {
    throw new RequestError("Send a JSON request.", 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("The request was empty.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let source = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        throw new RequestError("The request is too large.", 413);
      }
      source += decoder.decode(value, { stream: true });
    }
    const result: unknown = JSON.parse(source + decoder.decode());
    if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error("Invalid JSON object");
    return result as Input;
  } catch (cause) {
    if (cause instanceof RequestError) throw cause;
    throw new RequestError("The request could not be read.");
  } finally {
    reader.releaseLock();
  }
}

function bounded(value: unknown, field: string, min: number, max: number) {
  if (typeof value !== "string") throw new RequestError(`Check the ${field}.`);
  const cleaned = value.normalize("NFKC").trim();
  if (cleaned.length < min || cleaned.length > max || /[\x00-\x08\x0B-\x1F\x7F]/.test(cleaned)) {
    throw new RequestError(`Check the length and characters of the ${field}.`);
  }
  return cleaned;
}

function sharedText(value: unknown, field: string, min: number, max: number) {
  const cleaned = bounded(value, field, min, max);
  const emailOrLink = /[\p{L}\d_.+-]+@[\p{L}\d-]+\.[\p{L}]{2,}|(?:https?:\/\/|www\.)/iu;
  const phone = /(?:^|[^\d])(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}(?!\d)/;
  const streetNumber = /\b\d{1,6}\s+(?:(?:[NSEW]|North|South|East|West)\.?\s+)?(?:[\p{L}\d.'’-]+\s+){1,4}(?:street|avenue|road|lane|boulevard|drive|court|place|way|trail|st|ave|rd|ln|blvd|dr|ct|pl|trl)\b/iu;
  if (emailOrLink.test(cleaned) || phone.test(cleaned) || streetNumber.test(cleaned)) {
    throw new RequestError("Leave email addresses, phone numbers, links, and exact addresses out of your post or note.");
  }
  return cleaned;
}

function area(value: unknown) {
  if (typeof value !== "string" || !areaNames.has(value)) {
    throw new RequestError("Choose a listed area where you can meet, pick up a car, or get dropped off.");
  }
  return value;
}

function time(value: unknown) {
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new RequestError("Enter both commute times.");
  return value;
}

function dayOfTrip(value: unknown, now: number) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestError("Choose a day for the one-time trip.");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ||
      value < localDate.format(now) || value > localDate.format(now + postLifetime)) {
    throw new RequestError("Choose a date between today and 60 days from now.");
  }
  return value;
}

function expiry(fields: ListingInput, now: number) {
  if (fields.kind !== "oneoff") return now + postLifetime;
  // 05:00 UTC is 00:00 or 01:00 local, both before Indiana's DST transition hour.
  const followingDay = Date.parse(`${fields.date}T05:00:00Z`) + day;
  return followingDay - Number(localHour.format(followingDay)) * 60 * 60 * 1000;
}

function listingInput(input: Input, now: number, user: ChatGPTUser): ListingInput {
  const { kind, role } = input;
  if (kind !== "carpool" && kind !== "oneoff" && kind !== "carshare") throw new RequestError("Choose a listing category.");
  if (role !== "offer" && role !== "request") throw new RequestError("Choose whether you are offering or requesting.");
  if (!Array.isArray(input.days) || input.days.length > 7 || input.days.some(value => !dayNames.has(value))) {
    throw new RequestError("Choose valid days.");
  }
  const days = DAYS.filter(value => (input.days as string[]).includes(value));
  if (kind === "carpool" && !days.length) throw new RequestError("Choose at least one commute day.");
  if (input.nearCityBus !== undefined && typeof input.nearCityBus !== "boolean") {
    throw new RequestError("Choose whether you can meet near a CityBus stop.");
  }
  const purdue = input.purdue === true;
  if (purdue && !purdueEmail(user)) throw new RequestError("The Purdue badge requires a verified @purdue.edu sign-in email.", 403);

  return {
    kind, role, purdue, nearCityBus: input.nearCityBus === true, days: kind === "oneoff" ? [] : days,
    date: kind === "oneoff" ? dayOfTrip(input.date, now) : "",
    title: sharedText(input.title, "title", 5, 70),
    area: area(input.area),
    destination: kind === "carshare" ? "" : area(input.destination),
    start: kind === "carshare" ? "" : time(input.start),
    end: kind === "carpool" ? time(input.end) : "",
    note: sharedText(input.note ?? "", "listing note", 0, 400),
  };
}

function identifier(value: unknown) {
  if (typeof value !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value)) {
    throw new RequestError("This item is no longer available.", 404);
  }
  return value;
}

function listingValues(input: ListingInput) {
  return [input.kind, input.role, input.title, input.area, input.destination, JSON.stringify(input.days), input.date, input.start, input.end, input.note, Number(input.purdue)];
}

async function writeWithReceipt(
  db: D1Database, statement: D1PreparedStatement, user: ChatGPTUser,
  targetId: string, action: string, now: number,
) {
  const [result] = await db.batch([
    statement,
    db.prepare(`
      INSERT INTO terms_receipts (id, user_id, target_id, action, version, created_at)
      SELECT ?, ?, ?, ?, ?, ? WHERE changes() > 0
    `).bind(crypto.randomUUID(), user.userId, targetId, action, TERMS_VERSION, now),
  ]);
  return result;
}

export async function POST(request: Request) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      throw new RequestError("Open the site directly to make changes.", 403);
    }
    const user = await getChatGPTUser();
    if (!user) throw new RequestError("Sign in to use this feature.", 401);
    const input = await readInput(request);
    const requiresTerms = input.action === "create" || input.action === "update" ||
      input.action === "request" || (input.action === "respond" && input.decision === "accept");
    if (requiresTerms && input.termsVersion !== TERMS_VERSION) {
      throw new RequestError("Review and agree to the current terms before continuing.");
    }
    const db = database();
    const now = Date.now();
    switch (input.action) {
      case "create": {
        const id = crypto.randomUUID();
        const fields = listingInput(input, now, user);
        const values = listingValues(fields);
        const statement = db.prepare(`
          INSERT INTO listings (id, owner_id, name, kind, role, title, area, destination, days, date, "start", "end", note, purdue, near_citybus, created_at, updated_at, expires)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT COUNT(*) FROM listings WHERE owner_id = ? AND created_at > ?) < ${MAX_POSTS_PER_24_HOURS}
            AND (SELECT COUNT(*) FROM listings WHERE owner_id = ? AND removed_at IS NULL AND expires > ?) < ${MAX_ACTIVE_POSTS}
        `).bind(id, user.userId, displayName(user), ...values, Number(fields.nearCityBus), now, now, expiry(fields, now),
          user.userId, now - day, user.userId, now);
        const result = await writeWithReceipt(db, statement, user, id, "create", now);
        if (!result.meta.changes) {
          const recent = await db.prepare("SELECT COUNT(*) AS total FROM listings WHERE owner_id = ? AND created_at > ?")
            .bind(user.userId, now - day).first<number>("total");
          const nextStep = (recent ?? 0) >= MAX_POSTS_PER_24_HOURS
            ? `Try again 24 hours after the earliest of your last ${MAX_POSTS_PER_24_HOURS} new posts. Removed posts still count for that period.`
            : "Remove an active post or wait for one to expire before publishing another.";
          throw new RequestError(`${POSTING_LIMITS} ${nextStep}`, 429);
        }
        break;
      }
      case "update": {
        const id = identifier(input.id);
        const fields = listingInput(input, now, user);
        const values = listingValues(fields);
        const statement = db.prepare(`
          UPDATE listings SET kind = ?, role = ?, title = ?, area = ?, destination = ?, days = ?, date = ?, "start" = ?, "end" = ?, note = ?, purdue = ?, near_citybus = COALESCE(?, near_citybus), updated_at = ?, expires = ?
          WHERE id = ? AND owner_id = ? AND removed_at IS NULL AND hidden_at IS NULL
            AND (expires > ? OR (SELECT COUNT(*) FROM listings WHERE owner_id = ? AND removed_at IS NULL AND expires > ?) < ${MAX_ACTIVE_POSTS})
        `).bind(...values, input.nearCityBus === undefined ? null : Number(fields.nearCityBus), now, expiry(fields, now), id, user.userId, now, user.userId, now);
        const result = await writeWithReceipt(db, statement, user, id, "update", now);
        if (!result.meta.changes) {
          const expired = await db.prepare("SELECT 1 FROM listings WHERE id = ? AND owner_id = ? AND removed_at IS NULL AND hidden_at IS NULL AND expires <= ?")
            .bind(id, user.userId, now).first();
          if (expired) throw new RequestError(`Remove an active post before renewing this one. You can have up to ${MAX_ACTIVE_POSTS} active posts.`, 429);
          throw new RequestError("This post is not available for editing.", 404);
        }
        break;
      }
      case "remove": {
        const id = identifier(input.id);
        const results = await db.batch([
          db.prepare("UPDATE listings SET removed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND removed_at IS NULL")
            .bind(now, now, id, user.userId),
          db.prepare("UPDATE intros SET status = 'declined', sender_email = '', updated_at = ? WHERE listing_id = ? AND recipient_id = ? AND status = 'pending'")
            .bind(now, id, user.userId),
        ]);
        if (!results[0].meta.changes) {
          const removed = await db.prepare("SELECT 1 FROM listings WHERE id = ? AND owner_id = ? AND removed_at IS NOT NULL").bind(id, user.userId).first();
          if (!removed) throw new RequestError("This post is unavailable.", 404);
        }
        break;
      }
      case "request": {
        const id = identifier(input.id);
        const note = sharedText(input.note ?? "", "introduction note", 0, 240);
        const introId = crypto.randomUUID();
        const statement = db.prepare(`
          INSERT INTO intros (id, listing_id, title, sender_id, sender_name, sender_email, recipient_id, recipient_name, status, note, created_at, updated_at)
          SELECT ?, id, title, ?, ?, ?, owner_id, name, 'pending', ?, ?, ?
          FROM listings WHERE id = ? AND owner_id != ? AND ${activeListing}
            AND (SELECT COUNT(*) FROM intros WHERE sender_id = ? AND created_at > ?) < 12
          ON CONFLICT(sender_id, listing_id) DO NOTHING
        `).bind(introId, user.userId, displayName(user), user.email, note, now, now, id, user.userId, now, user.userId, now - day);
        const result = await writeWithReceipt(db, statement, user, introId, "request", now);
        if (!result.meta.changes) {
          const existing = await db.prepare("SELECT 1 FROM intros WHERE listing_id = ? AND sender_id = ?").bind(id, user.userId).first();
          if (!existing) throw new RequestError("This post is unavailable or you’ve reached today’s introduction limit.", 409);
        }
        break;
      }
      case "respond": {
        const id = identifier(input.id);
        if (input.decision !== "accept" && input.decision !== "decline") throw new RequestError("Choose accept or decline.");
        const accept = input.decision === "accept";
        const status = accept ? "accepted" : "declined";
        const statement = db.prepare(`
          UPDATE intros
          SET status = ?, recipient_email = ?, sender_email = CASE WHEN ? THEN sender_email ELSE '' END, updated_at = ?
          WHERE id = ? AND recipient_id = ? AND status = 'pending'
            AND EXISTS (SELECT 1 FROM listings WHERE listings.id = intros.listing_id AND ${activeListing})
        `).bind(status, accept ? user.email : null, accept ? 1 : 0, now, id, user.userId, now);
        const result = accept ? await writeWithReceipt(db, statement, user, id, "accept", now) : await statement.run();
        if (!result.meta.changes) {
          const existing = await db.prepare("SELECT status FROM intros WHERE id = ? AND recipient_id = ?").bind(id, user.userId).first<string>("status");
          if (existing !== status) throw new RequestError("This introduction is no longer available.", 409);
        }
        break;
      }
      case "report": {
        const id = identifier(input.id);
        const reason = bounded(input.reason, "report reason", 5, 240);
        await db.batch([
          db.prepare(`
            INSERT INTO reports (listing_id, reporter_id, reason, created_at)
            SELECT id, ?, ?, ? FROM listings
            WHERE id = ? AND owner_id != ? AND ${activeListing}
              AND (SELECT COUNT(*) FROM reports WHERE reporter_id = ? AND created_at > ?) < 10
            ON CONFLICT(listing_id, reporter_id) DO NOTHING
          `).bind(user.userId, reason, now, id, user.userId, now, user.userId, now - day),
          db.prepare(`
            UPDATE listings SET hidden_at = ?
            WHERE id = ? AND hidden_at IS NULL
              AND (SELECT COUNT(*) FROM reports WHERE listing_id = ?) >= 3
          `).bind(now, id, id),
        ]);
        const submitted = await db.prepare("SELECT 1 FROM reports WHERE listing_id = ? AND reporter_id = ?").bind(id, user.userId).first();
        if (!submitted) throw new RequestError("This post is unavailable or you’ve reached today’s reporting limit.", 409);
        break;
      }
      default:
        throw new RequestError("Choose a board action.");
    }
    return json({ ok: true });
  } catch (cause) {
    return failure(cause);
  }
}
