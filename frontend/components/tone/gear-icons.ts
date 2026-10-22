import type { GearKind } from "@prisma/client";
import type { IconName } from "@/components/icons/Icon";

export const KIND_ICON: Record<GearKind, IconName> = { GUITAR: "guitar", BASS: "bass", PICKUP: "pickup", AMP: "amp", CAB: "cab", PEDAL: "pedal", MULTIFX: "multifx", MODELER: "modeler", PLUGIN: "plugin" };
export const KIND_LABEL: Record<GearKind, string> = { GUITAR: "Guitars", BASS: "Basses", PICKUP: "Pickups", AMP: "Amps", CAB: "Cabs", PEDAL: "Pedals", MULTIFX: "Multi-FX", MODELER: "Modelers", PLUGIN: "Plugins" };
