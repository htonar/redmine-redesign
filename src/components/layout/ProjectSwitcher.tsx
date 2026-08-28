import { useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Project } from "@/hooks/useProjects";
import { orderProjectsHierarchically } from "@/lib/project-tree";

export interface ProjectSwitcherProps {
  projects: Project[];
  loading: boolean;
  /** null - "Все проекты". */
  selectedProjectId: number | null;
  onChange: (projectId: number | null) => void;
}

/**
 * Переключатель проекта в шапке (issue #63): поиск по имени и отступы для
 * вложенных проектов - на self-hosted Redmine проектов бывают десятки, плоский
 * dropdown без поиска был неудобен.
 */
export function ProjectSwitcher({
  projects,
  loading,
  selectedProjectId,
  onChange,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false);

  const ordered = useMemo(
    () => orderProjectsHierarchically(projects),
    [projects],
  );

  const currentName =
    projects.find((p) => p.id === selectedProjectId)?.name ?? "Все проекты";

  function select(id: number | null) {
    onChange(id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[8rem] gap-1.5 sm:max-w-none"
          disabled={loading}
          aria-label="Выбрать проект"
        >
          <span className="truncate">
            {loading ? "Загрузка..." : currentName}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          <CommandInput placeholder="Поиск проекта..." />
          <CommandList>
            <CommandEmpty>Проектов не найдено</CommandEmpty>
            <CommandGroup>
              <CommandItem value="Все проекты" onSelect={() => select(null)}>
                <Check
                  className={cn(
                    "size-3.5",
                    selectedProjectId === null ? "opacity-100" : "opacity-0",
                  )}
                />
                Все проекты
              </CommandItem>
              {ordered.map(({ project, depth }) => (
                <CommandItem
                  key={project.id}
                  value={`${project.name} ${project.id}`}
                  onSelect={() => select(project.id)}
                >
                  <Check
                    className={cn(
                      "size-3.5",
                      selectedProjectId === project.id
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span
                    className="truncate"
                    style={{ paddingLeft: depth * 12 }}
                  >
                    {project.name}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
