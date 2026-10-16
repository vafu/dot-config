{
  description = "kcd package and Home Manager service";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      version = "1.20.0";
      hashes = {
        x86_64-linux = "314ee99ef57249abc56747ba3daac76f7956da1deceadba8c8370d144b39d328";
        aarch64-linux = "eee154f4e66bf0876f0e37d5d047b61140ea9164ab90d46cd7be9b6153a06bcf";
      };
    in {
      packages = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
          arch = if system == "x86_64-linux" then "x86_64" else "aarch64";
        in rec {
          default = kcd;
          kcd = pkgs.stdenvNoCC.mkDerivation {
            pname = "kcd";
            inherit version;
            src = pkgs.fetchurl {
              url = "https://github.com/bethropolis/kcd/releases/download/v${version}/kcd_${version}_linux_${arch}.tar.gz";
              sha256 = hashes.${system};
            };
            sourceRoot = ".";
            nativeBuildInputs = [ pkgs.makeWrapper ];
            dontConfigure = true;
            dontBuild = true;
            installPhase = ''
              runHook preInstall
              install -Dm755 kcd "$out/bin/kcd"
              install -Dm644 packaging/kcd.bash-completion "$out/share/bash-completion/completions/kcd"
              install -Dm644 packaging/kcd.fish-completion "$out/share/fish/vendor_completions.d/kcd.fish"
              install -Dm644 packaging/kcd.zsh-completion "$out/share/zsh/site-functions/_kcd"
              wrapProgram "$out/bin/kcd" \
                --prefix PATH : ${pkgs.lib.makeBinPath [
                  pkgs.wl-clipboard pkgs.libnotify pkgs.xdg-utils
                ]}
              runHook postInstall
            '';
            meta = {
              description = "Headless KDE Connect daemon and CLI";
              homepage = "https://github.com/bethropolis/kcd";
              license = pkgs.lib.licenses.mit;
              platforms = systems;
              mainProgram = "kcd";
              sourceProvenance = [ pkgs.lib.sourceTypes.binaryNativeCode ];
            };
          };
        });

      homeManagerModules.default = { config, lib, pkgs, ... }:
        let
          cfg = config.services.kcd;
        in {
          options.services.kcd = {
            enable = lib.mkEnableOption "kcd";
            package = lib.mkOption {
              type = lib.types.package;
              default = self.packages.${pkgs.stdenv.hostPlatform.system}.kcd;
              description = "kcd package to install and run.";
            };
            extraPackages = lib.mkOption {
              type = lib.types.listOf lib.types.package;
              default = [ ];
              description = "Additional daemon helpers, such as sshfs or wtype.";
            };
            target = lib.mkOption {
              type = lib.types.str;
              default = "graphical-session.target";
              description = "Session target that starts and stops kcd.";
            };
          };

          config = lib.mkIf cfg.enable {
            home.packages = [ cfg.package ] ++ cfg.extraPackages;
            systemd.user.services.kcd = {
              Unit = {
                Description = "Headless KDE Connect Daemon";
                After = [ cfg.target ];
                PartOf = [ cfg.target ];
              };
              Service = {
                Type = "notify";
                NotifyAccess = "main";
                ExecStart = "${lib.getExe cfg.package} daemon";
                Environment = [
                  "XDG_CONFIG_HOME=${config.xdg.configHome}"
                  "PATH=${lib.makeBinPath (
                    [ pkgs.coreutils pkgs.systemd pkgs.wl-clipboard pkgs.libnotify pkgs.xdg-utils ]
                    ++ cfg.extraPackages
                  )}:%h/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin"
                ];
                Restart = "on-failure";
                RestartSec = 5;
                KillMode = "mixed";
                TimeoutStopSec = 10;
              };
              Install.WantedBy = [ cfg.target ];
            };
          };
        };
    };
}
