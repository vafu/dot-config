{
  # A description for your flake
  description = "A flake for a Hyprland desktop environment";

  # Inputs are the dependencies of your flake.
  inputs = {
    # The primary source of packages
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    # Hyprland's own flake, for the latest updates
    hyprland.url = "github:hyprwm/Hyprland";

    # A utility library to make flakes easier to write
    flake-utils.url = "github:numtide/flake-utils";
  };

  # Outputs define what your flake provides.
  outputs = { self, nixpkgs, hyprland, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        # Use the 'unstable' package set for the latest software
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        # The main output: a shell environment you can enter
        # You can name 'default' whatever you like, e.g., 'hyprland-shell'
        devShells.default = pkgs.mkShell {
          # The list of packages you want available in your environment
          packages = [
            # The main compositor
            hyprland.packages.${system}.default

            # For screen sharing and screenshots
            pkgs.xdg-desktop-portal-hyprland
          ];
        };
      }
    );
}
