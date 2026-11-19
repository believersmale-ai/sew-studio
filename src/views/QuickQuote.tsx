"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, ShoppingBag, TrendingUp, Save } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SavedQuotes } from "@/components/quotes/SavedQuotes";
import { apiErrorMessage, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/stores/auth";
import type { Customer, Settings } from "@/lib/types";
import { orderOverheadMargin, defaultMarkupPercent } from "@/lib/format";
import { PageHeader } from "@/components/atelier/PageHeader";
import { SectionCard } from "@/components/atelier/SectionCard";
import { AnimatedNumber } from "@/components/atelier/AnimatedNumber";
import { PremiumButton } from "@/components/atelier/PremiumButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { useNav } from "@/stores/nav";
import { cn } from "@/lib/utils";

type GarmentType =
  | "Gown"
  | "Suit"
  | "Dress"
  | "Agbada"
  | "Skirt Set"
  | "Slit & Koba"
  | "Shirt"
  | "Trousers"
  | "Other";

type FabricType =
  | "Lace"
  | "Silk"
  | "Kente"
  | "Cotton"
  | "Velvet"
  | "Chiffon"
  | "Satin"
  | "Wool"
  | "Linen"
  | "Crepe"
  | "Other";

type Complexity = "Simple" | "Moderate" | "Elaborate" | "Couture";
type Embellishment =
  | "None"
  | "Beading"
  | "Embroidery"
  | "Crystal"
  | "Hand-painted";

const GARMENT_TYPES: GarmentType[] = [
  "Gown",
  "Suit",
  "Dress",
  "Agbada",
  "Skirt Set",
  "Slit & Koba",
  "Shirt",
  "Trousers",
  "Other",
];

const FABRICS: { label: FabricType; basePerYard: number }[] = [
  { label: "Lace", basePerYard: 180 },
  { label: "Silk", basePerYard: 220 },
  { label: "Kente", basePerYard: 350 },
  { label: "Cotton", basePerYard: 80 },
  { label: "Velvet", basePerYard: 200 },
  { label: "Chiffon", basePerYard: 120 },
  { label: "Satin", basePerYard: 150 },
  { label: "Wool", basePerYard: 250 },
  { label: "Linen", basePerYard: 140 },
  { label: "Crepe", basePerYard: 160 },
  { label: "Other", basePerYard: 150 },
];

const LABOUR_BASE: Record<GarmentType, number> = {
  Gown: 600,
  Suit: 800,
  Dress: 500,
  Agbada: 700,
  "Skirt Set": 450,
  "Slit & Koba": 500,
  Shirt: 300,
  Trousers: 350,
  Other: 500,
};

const COMPLEXITY_MULTIPLIER: Record<Complexity, number> = {
  Simple: 1.0,
  Moderate: 1.3,
  Elaborate: 1.6,
  Couture: 2.0,
};

const COMPLEXITY_LABEL: Record<Complexity, string> = {
  Simple: "1.0×",
  Moderate: "1.3×",
  Elaborate: "1.6×",
  Couture: "2.0×",
};

const EMBELLISHMENT_COST: Record<Embellishment, number> = {
  None: 0,
  Beading: 400,
  Embroidery: 250,
  Crystal: 600,
  "Hand-painted": 350,
};

type CostItem = { id: string; name: string; quantity: number; unitCost: number };
type Extra = { id: string; name: string; price: number; cost: number; accepted: boolean };
const id = () => Math.random().toString(36).slice(2);
export default function QuickQuote() {
  const go = useNav((s) => s.go);

  const [garment, setGarment] = useState<GarmentType>("Gown");
  const [fabric, setFabric] = useState<FabricType>("Lace");
  const [yards, setYards] = useState<number>(3);
  const [complexity, setComplexity] = useState<Complexity>("Moderate");
  const [embellishment, setEmbellishment] = useState<Embellishment>("None");
  const [rush, setRush] = useState<boolean>(false);
  const [wastagePct, setWastagePct] = useState(0);
  const [labourBaseOverride, setLabourBaseOverride] = useState<number | null>(null);
  const [rushPercentOverride, setRushPercentOverride] = useState<number | null>(null);
  const [otherCosts, setOtherCosts] = useState(0);
  const [items, setItems] = useState<CostItem[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [itemName, setItemName] = useState("");
  const [itemQty, setItemQty] = useState(1);
  const [itemCost, setItemCost] = useState(0);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState(0);
  const [extraCost, setExtraCost] = useState(0);
  const [clientFabric, setClientFabric] = useState(false);
  const [handlingCost, setHandlingCost] = useState(0);
  const [itemPresets, setItemPresets] = useState<{name:string;unitCost:number}[]>([]);
  const [extraPresets, setExtraPresets] = useState<{name:string;price:number;cost:number}[]>([]);
  const shopName = useAuth(a => a.user?.shop?.name);
  useEffect(() => {
    if (!shopName) return;
    try {
      const value = JSON.parse(localStorage.getItem("sewsiness-quote-presets:" + shopName) || "{}");
      if (Array.isArray(value.items)) setItemPresets(value.items.filter((x: {name?:unknown;unitCost?:unknown}) => typeof x.name === "string" && typeof x.unitCost === "number").slice(0,100));
      if (Array.isArray(value.extras)) setExtraPresets(value.extras.filter((x: {name?:unknown;price?:unknown;cost?:unknown}) => typeof x.name === "string" && typeof x.price === "number" && typeof x.cost === "number").slice(0,100));
    } catch { /* Invalid optional local presets do not prevent quoting. */ }
  }, [shopName]);
  const savePresets = (savedItems: typeof itemPresets, savedExtras: typeof extraPresets) => {
    if (!shopName) return;
    try { localStorage.setItem("sewsiness-quote-presets:" + shopName, JSON.stringify({items:savedItems,extras:savedExtras})); }
    catch { toast.error("Could not save suggestions on this device."); }
  };
  const addItem = () => {
    if (!itemName.trim()) { toast.error("Enter an item name."); return; }
    setItems(v => [...v, {id:id(),name:itemName.trim(),quantity:Math.max(0,itemQty),unitCost:Math.max(0,itemCost)}]);
    const saved = [...itemPresets.filter(x => x.name.toLowerCase() !== itemName.trim().toLowerCase()),{name:itemName.trim(),unitCost:Math.max(0,itemCost)}];
    setItemPresets(saved); savePresets(saved,extraPresets); setItemName(""); setItemQty(1); setItemCost(0);
  };
  const addExtra = () => {
    if (!extraName.trim()) { toast.error("Enter an extra name."); return; }
    setExtras(v => [...v,{id:id(),name:extraName.trim(),price:Math.max(0,extraPrice),cost:Math.max(0,extraCost),accepted:true}]);
    const saved = [...extraPresets.filter(x => x.name.toLowerCase() !== extraName.trim().toLowerCase()),{name:extraName.trim(),price:Math.max(0,extraPrice),cost:Math.max(0,extraCost)}];
    setExtraPresets(saved); savePresets(itemPresets,saved); setExtraName(""); setExtraPrice(0); setExtraCost(0);
  };
  const [markupOverride, setMarkupOverride] = useState<number | null>(null);
  const [finalOverride, setFinalOverride] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [depositOverride, setDepositOverride] = useState<number | null>(null);

  const { data: pricingSettings } = useQuery<Settings>({ queryKey: ["settings"], queryFn: () => apiGet<Settings>("/api/settings") });
  const calc = useMemo(() => {
    const fabricBase =
      FABRICS.find((f) => f.label === fabric)?.basePerYard ?? 150;
    const safeYards = Math.max(0, Number(yards) || 0);

    const fabricCost = clientFabric ? 0 : fabricBase * safeYards;
    const labourBase = labourBaseOverride ?? LABOUR_BASE[garment] ?? 500;
    const labour = Math.round(labourBase * COMPLEXITY_MULTIPLIER[complexity]);
    const embellishmentCost = EMBELLISHMENT_COST[embellishment];
    const subtotal = fabricCost + labour + embellishmentCost;
    const rushPercent = rushPercentOverride ?? pricingSettings?.rushFeePercent ?? 25;
    const rushPremium = rush ? Math.round(subtotal * Math.max(0, rushPercent) / 100) : 0;
    const wastage = fabricCost * Math.max(0, wastagePct) / 100;
    const overhead = orderOverheadMargin({ fabricCost: fabricCost + wastage }, pricingSettings);
    const itemTotal = items.reduce((sum,x) => sum + x.quantity * x.unitCost, 0);
    const acceptedExtras = extras.filter(x => x.accepted);
    const extrasCost = acceptedExtras.reduce((sum,x) => sum + x.cost, 0);
    const extrasPrice = acceptedExtras.reduce((sum,x) => sum + x.price, 0);
    const trueCost = fabricCost + wastage + labour + embellishmentCost + Math.max(0, otherCosts) + itemTotal + (clientFabric ? Math.max(0,handlingCost) : 0) + extrasCost + overhead;
    const markup = markupOverride ?? defaultMarkupPercent(pricingSettings);
    const recommendedBase = Math.round((trueCost - extrasCost) * (1 + Math.max(0,markup) / 100) + rushPremium);
    const recommendedPrice = recommendedBase + extrasPrice;
    const finalPrice = (finalOverride ?? recommendedBase) + extrasPrice;
    const discount = finalPrice * Math.min(100, Math.max(0, discountPct)) / 100;
    const total = Math.max(0, finalPrice - discount);
    const depositPct = depositOverride ?? pricingSettings?.depositPercent ?? 50;
    const suggestedDeposit = Math.round(total * Math.min(100, Math.max(0, depositPct)) / 100);

    // Profit deducts all known production costs, including labour and allocated overhead.
    const estMargin = total - trueCost;
    const estMarginPct = total > 0 ? (estMargin / total) * 100 : 0;
    const markupPct = trueCost > 0 ? (estMargin / trueCost) * 100 : 0;

    return {
      fabricBase,
      fabricCost,
      labourBase,
      labour,
      rushPercent,
      embellishmentCost,
      subtotal,
      rushPremium,
      total,
      suggestedDeposit,
      estMargin,
      estMarginPct,
      markupPct,
      trueCost,
      overhead,
      markup,
      wastage,
      recommendedPrice,
      finalPrice,
      discount,
      depositPct,
      itemTotal,
      extrasCost,
      extrasPrice,
    };
  }, [garment, fabric, yards, complexity, embellishment, rush, pricingSettings, wastagePct, otherCosts, markupOverride, finalOverride, discountPct, depositOverride, items, extras, clientFabric, handlingCost, labourBaseOverride, rushPercentOverride]);

  const qc = useQueryClient();
  const [quoteCustomerId, setQuoteCustomerId] = useState("");
  const [validDays, setValidDays] = useState("14");
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/api/customers"),
  });
  const saveQuote = useMutation({
    mutationFn: () => {
      const until = new Date(Date.now() + Number(validDays) * 864e5).toISOString().slice(0, 10);
      const c = customers.find((x) => x.id === quoteCustomerId);
      return apiPost("/api/quotes", {
        garment: `${garment} — ${fabric}`,
        customerId: quoteCustomerId || null,
        customerName: c?.name,
        total: calc.total,
        deposit: calc.suggestedDeposit,
        validUntil: until,
        inputs: { garment, fabric, yards, complexity, embellishment, rush, labourBase: calc.labourBase, labour: calc.labour, rushPercent: calc.rushPercent, wastagePct, otherCosts, items, extras, clientFabric, handlingCost, markup: calc.markup, finalPrice: calc.finalPrice, discountPct, trueCost: calc.trueCost, profit: calc.estMargin, overhead: calc.overhead, depositPct: calc.depositPct },
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); toast.success("Quote saved"); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  const handleConvert = () => {
    go("new-order", {
      params: { garment: `${garment} — ${fabric}` },
    });
  };

  return (
    <div className="p-5 md:p-8 max-w-[900px] mx-auto w-full">
      <PageHeader
        eyebrow="Instant pricing"
        eyebrowIcon={Zap}
        title="Quotes"
        subtitle="Price a garment, save the quote and follow it to an order."
        actions={
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#800020]/8 border border-[#800020]/15 text-[#800020]">
            <Zap className="w-4 h-4" />
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Calculator form (3/5) */}
        <SectionCard
          title="Garment details"
          className="lg:col-span-3"
          bodyClassName="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="qq-garment">Garment Type</Label>
            <Select
              value={garment}
              onValueChange={(v) => setGarment(v as GarmentType)}
            >
              <SelectTrigger id="qq-garment" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GARMENT_TYPES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="qq-fabric">Fabric</Label>
            <Select
              value={fabric}
              onValueChange={(v) => setFabric(v as FabricType)}
            >
              <SelectTrigger id="qq-fabric" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FABRICS.map((f) => (
                  <SelectItem key={f.label} value={f.label}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-stone-500 tabular-nums">
              {formatCurrency(calc.fabricBase)} / yard
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="qq-yards">Yards</Label>
              <Input
                id="qq-yards"
                type="number"
                min={0}
                step={0.5}
                value={yards}
                onChange={(e) => setYards(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qq-complexity">Complexity</Label>
              <Select
                value={complexity}
                onValueChange={(v) => setComplexity(v as Complexity)}
              >
                <SelectTrigger id="qq-complexity" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Simple", "Moderate", "Elaborate", "Couture"] as Complexity[]).map(
                    (c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-stone-500 tabular-nums">
                Multiplier {COMPLEXITY_LABEL[complexity]}
              </p>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-[#EEDFE3] p-3">
            <p className="font-semibold text-sm">Labour costing</p>
            <p className="text-xs text-stone-500">Labour cost = base labour rate × selected complexity multiplier. Included in True Cost, not profit.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label htmlFor="qq-labour-base">Base labour (GHS)</Label><Input id="qq-labour-base" type="number" min={0} value={labourBaseOverride ?? LABOUR_BASE[garment]} onChange={e=>setLabourBaseOverride(Math.max(0,Number(e.target.value)||0))} /></div>
              <div className="grid gap-1"><Label>Complexity multiplier</Label><p className="rounded-md border bg-white px-3 py-2 text-sm">{COMPLEXITY_LABEL[complexity]}</p></div>
            </div>
            <p className="text-sm font-medium">Calculated labour: {formatCurrency(calc.labour)}</p>
            {labourBaseOverride !== null && <button type="button" className="text-xs text-[#800020] underline text-left" onClick={()=>setLabourBaseOverride(null)}>Restore garment default</button>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qq-embellishment">Embellishment</Label>
            <Select
              value={embellishment}
              onValueChange={(v) => setEmbellishment(v as Embellishment)}
            >
              <SelectTrigger id="qq-embellishment" className="w-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["None", "Beading", "Embroidery", "Crystal", "Hand-painted"] as Embellishment[]).map(
                  (e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                      {e !== "None" && ` · +${formatCurrency(EMBELLISHMENT_COST[e])}`}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3"><div><Label htmlFor="qq-client-fabric">Client's own fabric</Label><p className="text-xs text-stone-500">Fabric cost becomes zero.</p></div><Switch id="qq-client-fabric" checked={clientFabric} onCheckedChange={setClientFabric} /></div>
          {clientFabric && <div className="grid gap-1"><Label htmlFor="qq-handling">Handling allowance (GHS)</Label><Input id="qq-handling" type="number" min={0} value={handlingCost} onChange={e => setHandlingCost(Math.max(0,Number(e.target.value)||0))} /></div>}
          <Separator />
          <div className="grid gap-2">
            <h3 className="font-semibold">Other production items</h3>
            <p className="text-xs text-stone-500">Saved suggestions are stored on this device.</p>
            <select aria-label="Saved production items" className="w-full border rounded-md p-2" value="" onChange={e => { const x=itemPresets.find(x=>x.name===e.target.value); if(x){setItemName(x.name);setItemCost(x.unitCost);} }}><option value="">Choose a saved item…</option>{itemPresets.map(x=><option key={x.name} value={x.name}>{x.name} · {formatCurrency(x.unitCost)}</option>)}</select>
            <Label htmlFor="qq-item-name">Item name</Label><Input id="qq-item-name" placeholder="Zip, buttons, thread…" value={itemName} onChange={e=>setItemName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="qq-item-qty">Quantity</Label><Input id="qq-item-qty" type="number" min={0} value={itemQty} onChange={e=>setItemQty(Math.max(0,Number(e.target.value)||0))} /></div><div><Label htmlFor="qq-item-cost">Unit cost (GHS)</Label><Input id="qq-item-cost" type="number" min={0} value={itemCost} onChange={e=>setItemCost(Math.max(0,Number(e.target.value)||0))} /></div></div>
            <button type="button" onClick={addItem} className="rounded-md border p-2 font-medium">+ Add item</button>
            {items.map(x=><div key={x.id} className="flex justify-between gap-2 text-sm"><span>{x.name} × {x.quantity} · {formatCurrency(x.quantity*x.unitCost)}</span><button type="button" className="text-red-700 underline" onClick={()=>setItems(v=>v.filter(y=>y.id!==x.id))}>Remove</button></div>)}
          </div>
          <Separator />
          <div className="grid gap-2">
            <h3 className="font-semibold">Optional extras</h3>
            <p className="text-xs text-stone-500">Only accepted extras affect the total and profit. Client acceptance is recorded by the owner.</p>
            <select aria-label="Saved extras" className="w-full border rounded-md p-2" value="" onChange={e=>{const x=extraPresets.find(x=>x.name===e.target.value);if(x){setExtraName(x.name);setExtraPrice(x.price);setExtraCost(x.cost);}}}><option value="">Choose a saved extra…</option>{extraPresets.map(x=><option key={x.name} value={x.name}>{x.name} · {formatCurrency(x.price)}</option>)}</select>
            <Label htmlFor="qq-extra-name">Extra name</Label><Input id="qq-extra-name" placeholder="Laundry, lining, fitting…" value={extraName} onChange={e=>setExtraName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="qq-extra-price">Client price (GHS)</Label><Input id="qq-extra-price" type="number" min={0} value={extraPrice} onChange={e=>setExtraPrice(Math.max(0,Number(e.target.value)||0))} /></div><div><Label htmlFor="qq-extra-cost">Production cost (GHS)</Label><Input id="qq-extra-cost" type="number" min={0} value={extraCost} onChange={e=>setExtraCost(Math.max(0,Number(e.target.value)||0))} /></div></div>
            <button type="button" onClick={addExtra} className="rounded-md border p-2 font-medium">+ Add extra</button>
            {extras.map(x=><div key={x.id} className="flex justify-between gap-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={x.accepted} onChange={e=>setExtras(v=>v.map(y=>y.id===x.id?{...y,accepted:e.target.checked}:y))} />{x.name} · {formatCurrency(x.price)}</label><button type="button" className="text-red-700 underline" onClick={()=>setExtras(v=>v.filter(y=>y.id!==x.id))}>Remove</button></div>)}
          </div>
          <Separator />

          <div className="grid gap-1.5"><Label htmlFor="qq-rush-rate">Rush premium %</Label><Input id="qq-rush-rate" type="number" min={0} value={rushPercentOverride ?? pricingSettings?.rushFeePercent ?? 25} onChange={e=>setRushPercentOverride(Math.max(0,Number(e.target.value)||0))} /><p className="text-xs text-stone-500">Applied to fabric, labour and embellishment before the selling-price discount.</p></div>
          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="grid gap-0.5">
              <Label htmlFor="qq-rush" className="text-[#2F151B]">
                2-Week Rush
              </Label>
              <p className="text-xs text-stone-500">
                Adds a configurable premium to fabric, labour and embellishment.
              </p>
            </div>
            <Switch
              id="qq-rush"
              checked={rush}
              onCheckedChange={setRush}
              aria-label="Toggle rush production"
            />
          </div>
        </SectionCard>

        {/* Live summary (2/5) */}
        <div className="lg:col-span-2 lg:sticky lg:top-6">
          <SectionCard title="Estimate" bodyClassName="grid gap-3">
            <LineItem
              label={`Fabric · ${fabric} × ${yards || 0} yd`}
              value={calc.fabricCost}
            />
            <LineItem
              label={`Labour · ${garment} (${formatCurrency(calc.labourBase)} × ${COMPLEXITY_LABEL[complexity]})`}
              value={calc.labour}
            />
            {calc.embellishmentCost > 0 && (
              <LineItem
                label={`Embellishment · ${embellishment}`}
                value={calc.embellishmentCost}
              />
            )}

            <LineItem label={`Material wastage (${wastagePct}%)`} value={calc.wastage} />
            <LineItem label="Other production costs (manual)" value={otherCosts} />
            {items.map(x => <LineItem key={x.id} label={x.name + " × " + x.quantity} value={x.quantity * x.unitCost} />)}
            {clientFabric && <LineItem label="Client fabric handling" value={handlingCost} />}
            {extras.filter(x => x.accepted).map(x => <LineItem key={x.id} label={"Extra cost · " + x.name} value={x.cost} />)}
            <LineItem label="Allocated overhead" value={calc.overhead} />
            <LineItem label="TRUE COST" value={calc.trueCost} emphasized />
            <p className="text-xs text-stone-500">Labour is included in True Cost. Overhead follows studio settings.</p>
            <LineItem label={`Settings mark-up (${calc.markup}%)`} value={calc.trueCost * calc.markup / 100} />
            <Separator />

            {extras.filter(x => x.accepted).map(x => <LineItem key={x.id} label={"Accepted extra · " + x.name} value={x.price} />)}
            <LineItem label="Recommended selling price" value={calc.recommendedPrice} emphasized />

            {rush && (
              <LineItem
                label={`Rush premium (+${calc.rushPercent}% on fabric, labour and embellishment)`}
                value={calc.rushPremium}
                accent
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label htmlFor="qq-wastage">Wastage %</Label><Input id="qq-wastage" type="number" min={0} value={wastagePct} onChange={e => setWastagePct(Math.max(0, Number(e.target.value) || 0))} /></div>
              <div className="grid gap-1"><Label htmlFor="qq-other">Other costs (GHS)</Label><Input id="qq-other" type="number" min={0} value={otherCosts} onChange={e => setOtherCosts(Math.max(0, Number(e.target.value) || 0))} /></div>
              <div className="grid gap-1"><Label htmlFor="qq-markup">Mark-up %</Label><Input id="qq-markup" type="number" min={0} value={calc.markup} onChange={e => setMarkupOverride(Math.max(0, Number(e.target.value) || 0))} /></div>
              <div className="grid gap-1"><Label htmlFor="qq-deposit">Deposit %</Label><Input id="qq-deposit" type="number" min={0} max={100} value={calc.depositPct} onChange={e => setDepositOverride(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></div>
              <div className="grid gap-1"><Label htmlFor="qq-final">Base final price (GHS, excluding extras)</Label><Input id="qq-final" type="number" min={0} value={calc.finalPrice - calc.extrasPrice} onChange={e => setFinalOverride(Math.max(0, Number(e.target.value) || 0))} /></div>
              <div className="grid gap-1"><Label htmlFor="qq-discount">Discount %</Label><Input id="qq-discount" type="number" min={0} max={100} value={discountPct} onChange={e => setDiscountPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))} /></div>
            </div>
            {calc.discount > 0 && <LineItem label="Discount" value={-calc.discount} />}
            <Separator />

            <div className="mt-1 p-4 rounded-md border border-[#800020]/15 bg-gradient-to-br from-[#800020]/5 to-transparent">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#800020]">
                Final price after discount
              </p>
              <p
                className="font-display font-semibold text-[#800020] leading-tight tabular-nums"
                style={{ fontSize: "clamp(28px, 3vw, 40px)" }}
              >
                <AnimatedNumber value={calc.total} format="currency" />
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-stone-500">
                <span>{calc.depositPct}% deposit</span>
                <span className="font-medium text-[#2F151B] tabular-nums">
                  {formatCurrency(calc.suggestedDeposit)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#4A6B53]">
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Estimated profit
              </span>
              <span className="font-medium tabular-nums">
                {formatCurrency(calc.estMargin)} · margin {calc.estMarginPct.toFixed(1)}% · mark-up {calc.markupPct.toFixed(1)}%
              </span>
            </div>

            {calc.estMargin < 0 && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm font-semibold text-red-800">Warning: final price is below True Cost. This quote makes a loss.</p>}
            {calc.estMargin >= 0 && calc.estMarginPct < 10 && <p role="status" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">Low profit margin: consider reviewing the selling price.</p>}
            <PremiumButton
              onClick={handleConvert}
              size="md"
              className="w-full mt-1"
            >
              <ShoppingBag className="w-4 h-4" />
              Convert to Order
            </PremiumButton>

            <div className="grid gap-2 border-t border-[#EEDFE3] pt-3">
              <Label htmlFor="qq-customer">Save for customer (optional)</Label>
              <select
                id="qq-customer"
                value={quoteCustomerId}
                onChange={(e) => setQuoteCustomerId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                <option value="">No customer yet</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Label htmlFor="qq-valid">Valid for</Label>
              <select
                id="qq-valid"
                value={validDays}
                onChange={(e) => setValidDays(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              <PremiumButton variant="secondary" size="md" className="w-full" onClick={() => saveQuote.mutate()} disabled={saveQuote.isPending || calc.total <= 0}>
                <Save className="w-4 h-4" />
                {saveQuote.isPending ? "Saving…" : "Save quote"}
              </PremiumButton>
            </div>

            <p className="text-xs text-stone-400 text-center">
              Estimate only — final price may vary after consultation.
            </p>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5">
        <SavedQuotes shopName={shopName} />
      </div>
    </div>
  );
}

function LineItem({
  label,
  value,
  emphasized,
  accent,
}: {
  label: string;
  value: number;
  emphasized?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={cn(
          "text-sm",
          accent ? "text-amber-700" : "text-stone-500",
          emphasized && "text-[#2F151B] font-medium"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-sm tabular-nums",
          accent ? "text-amber-700 font-medium" : "text-[#2F151B]",
          emphasized && "font-semibold"
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
