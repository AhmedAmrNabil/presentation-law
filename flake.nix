{
  description = "DevSecOps presentation and demo environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/0bb2eedc20e4739f29e8045034f2828ad7054f8f";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forEachSupportedSystem = f: nixpkgs.lib.genAttrs supportedSystems (system: f {
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = true;
        };
      });
    in
    {
      devShells = forEachSupportedSystem ({ pkgs }: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            pnpm
            gh
            git
            gitleaks
            hadolint
            trivy
            jq
            curl
          ];

          shellHook = ''
            echo "🛡️  SecDevOps Environment Loaded"
            echo "   Node:    $(node --version)"
            echo "   pnpm:    $(pnpm --version)"
            echo "   Tools:   gitleaks, hadolint, trivy, gh"
          '';
        };
      });
    };
}
