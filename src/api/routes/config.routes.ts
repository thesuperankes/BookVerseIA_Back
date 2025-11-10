
import Elysia from "elysia";
import { getChildAgeRange, getChildThemes, getConfig, getFullConfig, setChildAgeRange, setChildThemes, setParentPin, updateFullConfig, verifyParentPin } from "../../controllers/config.controller.js";
import { secure } from "../../middleware/secure.js";

const configRoutes = new Elysia();


configRoutes.group("/config", (app) => {
    return app
        .post("/get-age", secure(async ({ user }) => {
            console.log(user.id)
            const { data, error } = await getChildAgeRange(user.id);
            if (error) return { status: 500, body: { ok: false, error: error.message } };
            return { status: 200, body: { ok: true, ageRange: data } };
        }))
        .post("/set-age", secure(async ({ user, body }: { user: any, body: any }) => {
            const ageRange = Number(body?.ageRange ?? body?.age);
            console.log(ageRange)
            if (!Number.isFinite(ageRange)) {
                return { status: 400, body: { ok: false, error: "ageRange (number) requerido" } };
            }

            const { data, error } = await setChildAgeRange(user.id, ageRange);
            if (error) return { status: 500, body: { ok: false, error: error.message } };
            return { status: 200, body: { ok: true, ageRange: data } };
        }))
        .post("/get-themes", secure(async ({ user }: { user: any }) => {
            const { data, error } = await getChildThemes(user.id);
            if (error) return { status: 500, body: { ok: false, error: error.message } };
            return { status: 200, body: { ok: true, themes: data } };
        }))
        .post("/set-themes", secure(async ({ user, body }: { user: any, body: any }) => {
            let themes = [];
            if (Array.isArray(body?.themes)) {
                themes = body.themes;
            } else if (typeof body?.themes === "string") {
                themes = body.themes.split(",").map((t: any) => t.trim()).filter(Boolean);
            } else if (typeof body === "string") {
                themes = body.split(",").map((t) => t.trim()).filter(Boolean);
            } else {
                return { status: 400, body: { ok: false, error: "themes debe ser array o string CSV" } };
            }
            const { data, error } = await setChildThemes(user.id, themes);
            if (error) return { status: 500, body: { ok: false, error: error.message } };
            return { status: 200, body: { ok: true, themes: data } };
        }))
        .post("/valid-config", secure(async ({ user }: { user: any }) => {
            const { result, error } = await getConfig(user.id);
            if (error) return { status: 500, body: { data: result, error: error.message } };
            return { status: 200, result };
        }))
        .post("/get-config", secure(async ({ user }: { user: any }) => {
            const { result, error } = await getFullConfig(user.id);
            if (error) return { status: 500, body: { ok: false, error: error.message } };
            return { status: 200, body: { ok: true, result: result } };
        }))
        .post("/set-config", secure(async ({ user, body }: { user: any; body: any }) => {
            // Extraemos posibles valores del body
            const ageRange = body?.child_age_range ?? body?.ageRange ?? null;
            const themes = body?.child_themes ?? body?.themes ?? null;
            const allowed = body?.allowed_themes ?? body?.allowed ?? null;
            const blocked = body?.blocked_themes ?? body?.blocked ?? null;
            const pin = body?.parent_pin ?? body?.pin ?? null;

            // Validación básica: al menos un campo debe venir
            if (
                ageRange === null &&
                !themes &&
                !allowed &&
                !blocked &&
                !pin
            ) {
                return {
                    status: 400,
                    body: { ok: false, error: "Debe enviar al menos un campo a actualizar" },
                };
            }

            // Construimos payload parcial
            const payload: any = {};
            if (ageRange !== null) {
                const num = Number(ageRange);
                if (!Number.isFinite(num)) {
                    return {
                        status: 400,
                        body: { ok: false, error: "child_age_range debe ser un número" },
                    };
                }
                payload.child_age_range = num;
            }
            if (themes) payload.child_themes = themes;
            if (allowed) payload.allowed_themes = allowed;
            if (blocked) payload.blocked_themes = blocked;
            if (pin) {
                if (typeof pin !== "string" || pin.length !== 4) {
                    return {
                        status: 400,
                        body: { ok: false, error: "parent_pin debe ser un string de 4 dígitos" },
                    };
                }
                payload.parent_pin = pin;
            }

            // Guardamos en la DB
            const { result, error } = await updateFullConfig(user.id, payload);

            if (error) {
                return {
                    status: 500,
                    body: { ok: false, error: error.message ?? "Error interno" },
                };
            }

            return { status: 200, body: { ok: true, config: result } };
        })

        )
        .post("/validate-parental-pin", secure(async ({ user, body }: { user: any, body: any }) => {
            const pin = String(body?.pin ?? "").trim();

            if (!pin || pin.length !== 4) {
                return { status: 400, body: { ok: false, error: "PIN de 4 dígitos requerido" } };
            }

            const { ok, error } = await verifyParentPin(user.id, pin);

            if (error && !ok) {
                return { status: 401, body: { ok: false, error } };
            }

            return { status: 200, body: { ok: true } };
        }))
        .post("/set-parental-pin", secure(async ({ user, body }: { user: any; body: any }) => {
            // Aceptamos { newPin } o { pin } para crear/cambiar

            console.log("Ingreso a la creación del pin parental")
            const newPin = String(body?.newPin ?? body?.pin ?? "").replace(/\D/g, "");
            const oldPin = body?.oldPin != null ? String(body.oldPin).replace(/\D/g, "") : null;

            // Validación del nuevo PIN
            if (!/^\d{4}$/.test(newPin)) {
                return {
                    status: 400,
                    body: { ok: false, error: "El nuevo PIN debe tener exactamente 4 dígitos." },
                };
            }

            // ¿Existe ya un PIN configurado?
            const { result, error: getErr } = await getFullConfig(user.id);
            if (getErr) {
                return { status: 500, body: { ok: false, error: getErr.message ?? "Error consultando configuración" } };
            }

            const hasExistingPin = Boolean(result?.parent_pin);

            // Si ya existe PIN, exigir oldPin y validarlo
            if (hasExistingPin) {
                if (!oldPin || !/^\d{4}$/.test(oldPin)) {
                    return {
                        status: 400,
                        body: { ok: false, error: "Debes enviar oldPin (4 dígitos) para cambiar el PIN existente." },
                    };
                }
                const check = await verifyParentPin(user.id, oldPin);
                if (!check.ok) {
                    return { status: 401, body: { ok: false, error: "PIN actual incorrecto." } };
                }
            }

            // Crear o actualizar el PIN
            const setRes = await setParentPin(user.id, newPin);
            if (!setRes.ok) {
                return {
                    status: 500,
                    body: { ok: false, error: setRes.error?.message ?? "No se pudo asignar el PIN." },
                };
            }

            return {
                status: 200,
                body: {
                    ok: true,
                    message: hasExistingPin ? "PIN actualizado correctamente." : "PIN creado correctamente.",
                },
            };
        })
        );



});

export default configRoutes;