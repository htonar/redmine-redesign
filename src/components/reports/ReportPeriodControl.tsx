import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPORT_PERIOD_PRESETS,
  type ReportPeriodPreset,
  type ReportPeriodValue,
} from "@/lib/report-period";

export interface ReportPeriodControlProps {
  value: ReportPeriodValue;
  onChange: (value: ReportPeriodValue) => void;
}

/** Выбор периода отчёта (issue #58): пресет + пара date-инпутов для «Произвольный период». */
export function ReportPeriodControl({
  value,
  onChange,
}: ReportPeriodControlProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value.preset}
        onValueChange={(v) =>
          onChange({ ...value, preset: v as ReportPeriodPreset })
        }
      >
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPORT_PERIOD_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-[9.5rem]"
            value={value.customFrom ?? ""}
            max={value.customTo || undefined}
            onChange={(e) =>
              onChange({ ...value, customFrom: e.target.value || undefined })
            }
            aria-label="Дата с"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            className="h-8 w-[9.5rem]"
            value={value.customTo ?? ""}
            min={value.customFrom || undefined}
            onChange={(e) =>
              onChange({ ...value, customTo: e.target.value || undefined })
            }
            aria-label="Дата по"
          />
        </div>
      )}
    </div>
  );
}
