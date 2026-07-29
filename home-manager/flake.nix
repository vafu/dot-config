{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    nixpkgs-codex.url = "github:nixos/nixpkgs/nixpkgs-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    ags = {
      url = "github:Aylur/ags";
      inputs.nixpkgs.follows = "nixpkgs";
      inputs.astal.follows = "astal";
    };

    astal = {
      url = "github:sameoldlab/astal?ref=feat/niri";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    nixGL = {
      url = "github:nix-community/nixGL";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    niri = {
      url = "github:sodiboo/niri-flake";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    ghostty = {
      url = "github:ghostty-org/ghostty";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    adw-gtk3-kanso = {
      url = "path:./flakes/adw-gtk3-kanso";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    rsynapse = {
      url = "path:/home/vfuchedzhy/proj/rsynapse";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    inputs@{ nixpkgs, nixpkgs-codex, home-manager, ... }:
    let
      system = "x86_64-linux";
      username = "vfuchedzhy";

      nixpkgsConfig = {
        allowUnfree = true;
        allowUnfreePredicate = _: true;
      };

      pkgs = import nixpkgs {
        inherit system;

        config = nixpkgsConfig;

        overlays = [
          (import ./overlays/hyprlock-pam.nix)
          (final: prev:
            let
              vcvRackFixSegfaultOnLinux = builtins.toFile "vcv-rack-fix-segfault-on-linux.patch" (
                builtins.concatStringsSep "\n" [
                  "--- a/src/window/Window.cpp"
                  "+++ b/src/window/Window.cpp"
                  "@@ -819,6 +819,10 @@"
                  " \tglfwInitHint(GLFW_COCOA_MENUBAR, GLFW_FALSE);"
                  " #endif"
                  " "
                  "+#if defined ARCH_LIN"
                  "+\tglfwInitHint(GLFW_PLATFORM, GLFW_PLATFORM_X11);"
                  "+#endif"
                  "+"
                  " \tglfwSetErrorCallback(errorCallback);"
                  " \terr = glfwInit();"
                  " \tif (err != GLFW_TRUE) {"
                  ""
                ]
              );

              isBrokenVcvRackPatch =
                patch:
                let
                  name =
                    if builtins.isAttrs patch && patch ? name then
                      patch.name
                    else
                      builtins.baseNameOf (toString patch);
                in
                name == "fix-segfault-on-linux.patch";
            in
            {
              vcv-rack = prev.vcv-rack.overrideAttrs (old: {
                patches =
                  builtins.filter (patch: !(isBrokenVcvRackPatch patch)) (old.patches or [ ])
                  ++ prev.lib.optionals prev.stdenv.hostPlatform.isLinux [
                    vcvRackFixSegfaultOnLinux
                  ];
              });
            })
          inputs.niri.overlays.niri
          (import ./overlays/libadwaita-theme.nix)
          inputs.rsynapse.overlays.default
        ];
      };

      pkgsCodex = import nixpkgs-codex {
        inherit system;
        config = nixpkgsConfig;
        overlays = [
          (final: prev: {
            codex = prev.stdenvNoCC.mkDerivation (finalAttrs: {
              pname = "codex";
              version = "0.146.0-alpha.13";

              src = prev.fetchurl {
                url = "https://github.com/openai/codex/releases/download/rust-v${finalAttrs.version}/codex-x86_64-unknown-linux-musl.tar.gz";
                hash = "sha256-bQLzTVm2ghBPzrFYPLWa11kuTimHPUalUohUcpXSJww=";
              };

              sourceRoot = ".";
              dontBuild = true;
              nativeBuildInputs = [ prev.makeBinaryWrapper ];

              installPhase = ''
                runHook preInstall
                install -Dm755 codex-x86_64-unknown-linux-musl "$out/bin/codex"
                runHook postInstall
              '';

              postFixup = ''
                wrapProgram $out/bin/codex --prefix PATH : ${prev.lib.makeBinPath ([ prev.ripgrep ] ++ prev.lib.optionals prev.stdenv.hostPlatform.isLinux [ prev.bubblewrap ])}
              '';

              meta = prev.codex.meta // {
                homepage = "https://github.com/openai/codex";
                mainProgram = "codex";
              };
            });
          })
        ];
      };
    in
    {
      formatter.${system} = pkgs.nixfmt;

      homeConfigurations.${username} = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;

        extraSpecialArgs = {
          inherit inputs username pkgsCodex;
        };

        modules = [ ./home.nix ];
      };
    };
}
