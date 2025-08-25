# ~/.config/nix-config/flake.nix
{
  description = "My Hyprland Flake";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
    home-manager =  {
       url = "github:nix-community/home-manager";
       inputs.nixpkgs.follows = "nixpkgs";
    };

    ags.url = "github:Aylur/ags";
    astal.url = "github:aylur/astal";

    nixGL = {
      url = "github:nix-community/nixGL";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { self, nixpkgs, home-manager, nixGL, ags, astal, ... }:
     {
      homeConfigurations."vfuchedzhy" = home-manager.lib.homeManagerConfiguration {
        pkgs = import nixpkgs {
          system = "x86_64-linux";
          allowUnfree = true;
          allowUnfreePredicate = _: true;
        };
        extraSpecialArgs = { inherit nixGL ags astal; };
        modules = [
          ./home.nix
        ];
      };
    };
}
