// Package all registers every built-in build recipe with the global registry.
// Import it with a blank identifier to activate all recipes:
//
//	import _ "github.com/deepak-ff/supply_chain/internal/build/recipes/all"
package all

import (
	"github.com/deepak-ff/supply_chain/internal/build/recipes"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/ai_model"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/crates"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/gomod"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/maven"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/mcp_server"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/npm"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/pypi"
	"github.com/deepak-ff/supply_chain/internal/build/recipes/rubygems"
)

func init() {
	recipes.Register(npm.New())
	recipes.Register(pypi.New())
	recipes.Register(maven.New())
	recipes.Register(gomod.New())
	recipes.Register(rubygems.New())
	recipes.Register(crates.New())
	recipes.Register(ai_model.New())
	recipes.Register(mcp_server.New())
}
