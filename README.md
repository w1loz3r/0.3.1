# Sakura Launcher — foundation 0.1.0

Собственный Minecraft Java launcher. Это не копия интерфейса Millida: здесь заложен отдельный UI и отдельный бренд. Техническая идея полноценного лаунчера — Tauri 2 + React + Rust.

## Уже есть
- собственный интерфейс и навигация;
- сборки/профили как отдельные сущности;
- переключение между автономным профилем и Microsoft UI;
- основа Tauri/Rust backend;
- Windows-ready структура;
- собственный пиксельный icon.png пользователя.

## Следующий этап ядра
1. Microsoft OAuth + secure token storage.
2. Minecraft manifest/version metadata.
3. Java runtime manager.
4. Vanilla/Fabric/Forge/NeoForge/Quilt installers.
5. Download queue + checksum verification.
6. Real launch pipeline.
7. Modrinth/CurseForge integration.
8. Import/export profiles and modpacks.
9. Worlds, servers, skins and logs.
10. Signed updater.

Важно: этот архив — исходный foundation, а не притворство, что Minecraft engine уже подключён. Реальное игровое ядро подключается следующим этапом.
