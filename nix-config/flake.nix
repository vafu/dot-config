# ~/.config/nix-config/flake.nix
{
  description = "My Hyprland Flake";

  inputs = {
    # Nix Packages collection
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";

    # Home manager
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    # AGS (Aylur's Gtk Shell)
    ags.url = "github:Aylur/ags";
  };

  outputs = { self, nixpkgs, home-manager, ags, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      homeConfigurations."vfuchedzhy" = home-manager.lib.homeManagerConfiguration {
        inherit pkgs;
        modules = [
          ./home.nix
          {
            # Pass ags as a special package to our home.nix
            home.packages = [ ags.packages.${system}.default ];
          }
        ];
      };
    };
}
