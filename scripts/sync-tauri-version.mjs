#!/usr/bin/env node
// Синхронизирует версию Tauri-бандла (src-tauri/Cargo.toml) с версией,
// которую CI (.github/workflows/desktop-release.yml) выставляет в
// package.json через `npm version`.
//
// Почему это отдельный шаг: tauri.conf.json намеренно не хранит свое поле
// "version" (см. CLAUDE.md, "GitHub Actions") - Tauri в этом случае должен
// был бы подхватывать версию из package.json, НО на практике падает
// обратно на version пакета из src-tauri/Cargo.toml, если она там задана -
// а она там задана (дефолт шаблона, "0.1.0"), и `npm version` эту версию
// не трогает вообще (это Rust/Cargo, не npm). Результат бага, который этот
// скрипт чинит: сборка с введенной версией "0.1.1" молча собирала
// бандл/latest.json с версией "0.1.0" на всех платформах - подтверждено
// содержимым реального черновика релиза redfine-v0.1.1.
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version) {
  console.error("Usage: node scripts/sync-tauri-version.mjs <version>");
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+/.test(version)) {
  console.error(`Отказ: "${version}" не похож на semver-версию`);
  process.exit(1);
}

const path = "src-tauri/Cargo.toml";
const content = readFileSync(path, "utf8");

// Правим версию только внутри секции [package] - у самого пакета "app", не
// у version = "..." зависимостей (tauri, tauri-build) ниже по файлу.
const packageHeaderIndex = content.indexOf("[package]");
if (packageHeaderIndex === -1) {
  console.error(`[package] не найден в ${path}`);
  process.exit(1);
}
const nextSectionIndex = content.indexOf("\n[", packageHeaderIndex + 1);
const sectionEnd = nextSectionIndex === -1 ? content.length : nextSectionIndex;
const packageSection = content.slice(0, sectionEnd);
const rest = content.slice(sectionEnd);

const updatedPackageSection = packageSection.replace(
  /^version = ".*"$/m,
  `version = "${version}"`,
);

if (updatedPackageSection === packageSection) {
  console.error(`Строка version = "..." не найдена в секции [package] (${path})`);
  process.exit(1);
}

writeFileSync(path, updatedPackageSection + rest);
console.log(`${path}: version -> ${version}`);
