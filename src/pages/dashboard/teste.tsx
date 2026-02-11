<div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                    <p className="text-sm text-blue-600 dark:text-blue-400">
                      💡 Use esta forma de agendamento caso o cliente tenha dificuldades
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Cliente</Label>
                      <Input
                        id="name"
                        value={newClient.name}
                        onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                        placeholder="João da Silva"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="birthdate">Serviço</Label>
                      <Input
                        id="birthdate"
                        type="text"
                        inputMode="numeric"
                        value={newClient.birthdate}
                        onChange={(e) => {
                          const maskedValue = maskDate(e.target.value);
                          setNewClient({ ...newClient, birthdate: maskedValue });
                        }}
                        onKeyPress={handleKeyPress}
                        maxLength={10}
                        placeholder="DD/MM/AAAA"
                        className="bg-background"
                      />
                    </div>
                    </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleSaveClient}
                      disabled={saving || !newClient.name || !newClient.whatsapp}
                      className="flex-1"
                    >
                      {saving ? "Salvando..." : "Cadastrar Cliente"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>