# positive: Ruby system() / backtick git push
def deploy
  system("git add -A")
  system("git push origin main")
end

def deploy_backtick
  `git push --tags`
end
