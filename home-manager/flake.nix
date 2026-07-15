{
  description = "Home Manager configuration";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    nixpkgs-codex.url = "github:nixos/nixpkgs/f205b5574fd0cb7da5b702a2da51507b7f4fdd1b";

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
          inputs.niri.overlays.niri
          (import ./overlays/libadwaita-theme.nix)
          inputs.rsynapse.overlays.default
        ];
      };

      pkgsCodex = import nixpkgs-codex {
        inherit system;
        config = nixpkgsConfig;
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
